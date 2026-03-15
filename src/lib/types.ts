import { Timestamp } from "firebase/firestore";

export interface Promo {
    id?: string;
    userId: string;
    promoting: string;
    promoterName: string;
    accountHandle: string;
    promoDate: Timestamp;
    tweetLink?: string;
    paymentMethod: string;
    paymentAmount: number;
    paymentStatus: "Pending" | "Paid" | "Overdue";
    notes?: string;
    createdAt: Timestamp;
    // Recurring fields
    isRecurring?: boolean;
    recurringFrequency?: "weekly" | "biweekly" | "monthly" | null;
    recurringEndType?: "never" | "after_count" | "until_date" | null;
    recurringEndValue?: number | null; // count or timestamp millis
    recurringGroupId?: string | null;
    isRecurringParent?: boolean;
    // Bundle fields
    isBundle?: boolean;
    bundleCount?: number | null; // number of posts in the bundle
    bundleIndex?: number | null; // which post out of the bundle count this is
    bundleGroupId?: string | null; // ID to link child posts to their parent bundle
    isBundleComplete?: boolean; // Manually hide from dropdowns
    // Engagement metrics
    impressions?: number | null;
    likes?: number | null;
    comments?: number | null;
    bookmarks?: number | null;
    retweets?: number | null;
}

export type PromoFormData = Omit<Promo, "id" | "userId" | "createdAt" | "promoDate"> & {
    promoDate: string;
};

export interface SavedPromoter {
    id?: string;
    userId: string;
    name: string;
    createdAt: Timestamp;
}

export interface SavedAccount {
    id?: string;
    userId: string;
    handle: string;
    createdAt: Timestamp;
}

export const PAYMENT_METHODS = [
    "PayPal",
    "Zelle",
    "CashApp",
    "Wire",
    "Invoice",
] as const;

export const PAYMENT_STATUSES = ["Pending", "Paid", "Overdue"] as const;

export const RECURRING_FREQUENCIES = [
    { value: "weekly", label: "Weekly" },
    { value: "biweekly", label: "Bi-weekly" },
    { value: "monthly", label: "Monthly" },
] as const;

export interface PromoDefaults {
    paymentMethod: string;
    accountHandle: string;
    promoterName: string;
}

export interface PromoterPreset {
    paymentMethod: string;
    amount: number | null;
}

export interface UserProfile {
    themeMode: "dark" | "light";
    accentColor: string;
    displayName: string;
    defaults: PromoDefaults;
    promoterPresets?: Record<string, PromoterPreset>;
}

export type DateRange = "7d" | "30d" | "90d" | "all" | "this_month" | "last_month";
export type TimeView = "daily" | "weekly" | "monthly";
