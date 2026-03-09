import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    query,
    where,
    getDocs,
    onSnapshot,
    Timestamp,
    writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { Promo, PromoFormData, SavedPromoter, SavedAccount } from "./types";

const PROMOS_COLLECTION = "promos";
const PROMOTERS_COLLECTION = "savedPromoters";
const ACCOUNTS_COLLECTION = "savedAccounts";

// Helper to parse "YYYY-MM-DD" in local time to avoid timezone offset shifts
function parseLocalDate(dateString: string): Date {
    const [year, month, day] = dateString.split("-").map(Number);
    return new Date(year, month - 1, day);
}

// ── Promo CRUD ────────────────────────────────────────────

export function subscribeToPromos(
    userId: string,
    callback: (promos: Promo[]) => void
) {
    const q = query(
        collection(db, PROMOS_COLLECTION),
        where("userId", "==", userId)
    );

    return onSnapshot(q, (snapshot) => {
        const promos: Promo[] = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        })) as Promo[];
        promos.sort((a, b) => (b.promoDate?.toMillis() || 0) - (a.promoDate?.toMillis() || 0));
        callback(promos);
    });
}

export async function addPromo(userId: string, data: PromoFormData) {
    const promoData = {
        ...data,
        userId,
        promoDate: Timestamp.fromDate(parseLocalDate(data.promoDate)),
        createdAt: Timestamp.now(),
    };
    return addDoc(collection(db, PROMOS_COLLECTION), promoData);
}

export async function updatePromo(promoId: string, data: Partial<PromoFormData>) {
    const updateData: Record<string, unknown> = { ...data };
    if (data.promoDate) {
        updateData.promoDate = Timestamp.fromDate(parseLocalDate(data.promoDate));
    }
    return updateDoc(doc(db, PROMOS_COLLECTION, promoId), updateData);
}

export async function deletePromo(promoId: string) {
    return deleteDoc(doc(db, PROMOS_COLLECTION, promoId));
}

// ── Recurring Promos ──────────────────────────────────────

function generateRecurringDates(
    startDate: Date,
    frequency: "weekly" | "biweekly" | "monthly",
    endType: "never" | "after_count" | "until_date",
    endValue: number | null
): Date[] {
    const dates: Date[] = [];
    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() + 3); // 3 months ahead

    let current = new Date(startDate);
    let count = 0;
    const maxOccurrences = endType === "after_count" && endValue ? endValue : 999;
    const untilDate = endType === "until_date" && endValue ? new Date(endValue) : maxDate;

    while (count < maxOccurrences) {
        // Advance to next date
        if (frequency === "weekly") {
            current = new Date(current);
            current.setDate(current.getDate() + 7);
        } else if (frequency === "biweekly") {
            current = new Date(current);
            current.setDate(current.getDate() + 14);
        } else {
            current = new Date(current);
            current.setMonth(current.getMonth() + 1);
        }

        if (current > untilDate || current > maxDate) break;

        dates.push(new Date(current));
        count++;
    }

    return dates;
}

export async function addRecurringPromo(userId: string, data: PromoFormData) {
    const groupId = `recurring_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    // Create parent promo
    const parentData = {
        ...data,
        userId,
        promoDate: Timestamp.fromDate(parseLocalDate(data.promoDate)),
        createdAt: Timestamp.now(),
        isRecurring: true,
        isRecurringParent: true,
        recurringGroupId: groupId,
    };
    await addDoc(collection(db, PROMOS_COLLECTION), parentData);

    // Generate child instances
    if (data.recurringFrequency && data.recurringEndType) {
        const futureDates = generateRecurringDates(
            parseLocalDate(data.promoDate),
            data.recurringFrequency,
            data.recurringEndType,
            data.recurringEndValue ?? null
        );

        const childPromises = futureDates.map((date) => {
            const childData = {
                ...data,
                userId,
                promoDate: Timestamp.fromDate(date),
                createdAt: Timestamp.now(),
                paymentStatus: "Pending" as const,
                isRecurring: true,
                isRecurringParent: false,
                recurringGroupId: groupId,
            };
            return addDoc(collection(db, PROMOS_COLLECTION), childData);
        });

        await Promise.all(childPromises);
    }
}

export async function editAllFutureRecurring(
    groupId: string,
    userId: string,
    updates: Partial<PromoFormData>
) {
    const q = query(
        collection(db, PROMOS_COLLECTION),
        where("userId", "==", userId),
        where("recurringGroupId", "==", groupId),
        where("isRecurringParent", "==", false)
    );

    const snapshot = await getDocs(q);
    const now = new Date();

    const updatePromises = snapshot.docs
        .filter((d) => {
            const data = d.data() as Promo;
            const promoDate = data.promoDate?.toDate();
            return promoDate && promoDate >= now && data.paymentStatus === "Pending";
        })
        .map((d) => {
            const updateData: Record<string, unknown> = { ...updates };
            if (updates.promoDate) {
                delete updateData.promoDate; // Don't change dates on future instances
            }
            return updateDoc(doc(db, PROMOS_COLLECTION, d.id), updateData);
        });

    await Promise.all(updatePromises);
}

export async function cancelRecurringSeries(groupId: string, userId: string) {
    const q = query(
        collection(db, PROMOS_COLLECTION),
        where("userId", "==", userId),
        where("recurringGroupId", "==", groupId),
        where("isRecurringParent", "==", false)
    );

    const snapshot = await getDocs(q);
    const now = new Date();

    const deletePromises = snapshot.docs
        .filter((d) => {
            const data = d.data() as Promo;
            const promoDate = data.promoDate?.toDate();
            return promoDate && promoDate >= now && data.paymentStatus === "Pending";
        })
        .map((d) => deleteDoc(doc(db, PROMOS_COLLECTION, d.id)));

    await Promise.all(deletePromises);
}

// ── Saved Promoters ───────────────────────────────────────

export function subscribeToSavedPromoters(
    userId: string,
    callback: (promoters: SavedPromoter[]) => void
) {
    const q = query(
        collection(db, PROMOTERS_COLLECTION),
        where("userId", "==", userId)
    );

    return onSnapshot(q, (snapshot) => {
        const promoters: SavedPromoter[] = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        })) as SavedPromoter[];
        promoters.sort((a, b) => a.name.localeCompare(b.name));
        callback(promoters);
    });
}

export async function addSavedPromoter(userId: string, name: string) {
    return addDoc(collection(db, PROMOTERS_COLLECTION), {
        userId,
        name,
        createdAt: Timestamp.now(),
    });
}

export async function deleteSavedPromoter(promoterId: string) {
    return deleteDoc(doc(db, PROMOTERS_COLLECTION, promoterId));
}

// ── Saved Accounts ────────────────────────────────────────

export function subscribeToSavedAccounts(
    userId: string,
    callback: (accounts: SavedAccount[]) => void
) {
    const q = query(
        collection(db, ACCOUNTS_COLLECTION),
        where("userId", "==", userId)
    );

    return onSnapshot(q, (snapshot) => {
        const accounts: SavedAccount[] = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        })) as SavedAccount[];
        accounts.sort((a, b) => a.handle.localeCompare(b.handle));
        callback(accounts);
    });
}

export async function addSavedAccount(userId: string, handle: string) {
    return addDoc(collection(db, ACCOUNTS_COLLECTION), {
        userId,
        handle,
        createdAt: Timestamp.now(),
    });
}

export async function deleteSavedAccount(accountId: string) {
    return deleteDoc(doc(db, ACCOUNTS_COLLECTION, accountId));
}

// ── Bulk Operations ───────────────────────────────────────

export async function bulkUpdateStatus(promoIds: string[], status: string) {
    const batch = writeBatch(db);
    promoIds.forEach((id) => {
        batch.update(doc(db, PROMOS_COLLECTION, id), { paymentStatus: status });
    });
    await batch.commit();
}
