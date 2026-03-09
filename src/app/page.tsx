"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import SummaryCards from "@/components/SummaryCards";
import PromoTable from "@/components/PromoTable";
import PromoModal from "@/components/PromoModal";
import { Promo, PromoFormData, SavedPromoter, SavedAccount, PromoterPreset } from "@/lib/types";
import {
  subscribeToPromos, addPromo, updatePromo, deletePromo,
  subscribeToSavedPromoters, subscribeToSavedAccounts,
  addRecurringPromo, cancelRecurringSeries,
} from "@/lib/promos";
import { exportPromoTablePDF } from "@/lib/pdfExport";
import { exportPromosToCSV } from "@/lib/csvExport";
import { useTheme } from "@/lib/ThemeContext";

export default function DashboardPage() {
  const { user } = useAuth();
  const { profile, updateProfile } = useTheme();
  const [promos, setPromos] = useState<Promo[]>([]);
  const [savedPromoters, setSavedPromoters] = useState<SavedPromoter[]>([]);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promo | null>(null);
  const [isDuplicate, setIsDuplicate] = useState(false);

  useEffect(() => {
    if (!user) return;

    const unsubPromos = subscribeToPromos(user.uid, (data) => {
      setPromos(data);
      setLoading(false);
    });

    const unsubPromoters = subscribeToSavedPromoters(user.uid, (data) => {
      setSavedPromoters(data);
    });

    const unsubAccounts = subscribeToSavedAccounts(user.uid, (data) => {
      setSavedAccounts(data);
    });

    return () => {
      unsubPromos();
      unsubPromoters();
      unsubAccounts();
    };
  }, [user]);

  const handleSave = async (data: PromoFormData) => {
    if (!user) return;

    if (isDuplicate) {
      // Duplicate = always create a new one-time promo
      const { isRecurring, recurringFrequency, recurringEndType, recurringEndValue, recurringGroupId, isRecurringParent, ...cleanData } = data;
      void isRecurring; void recurringFrequency; void recurringEndType; void recurringEndValue; void recurringGroupId; void isRecurringParent;
      await addPromo(user.uid, { ...cleanData, isRecurring: false, recurringFrequency: null, recurringEndType: null, recurringEndValue: null, recurringGroupId: null, isRecurringParent: false });
    } else if (editingPromo?.id) {
      await updatePromo(editingPromo.id, data);
    } else if (data.isRecurring) {
      await addRecurringPromo(user.uid, data);
    } else {
      await addPromo(user.uid, data);
    }
  };

  const handleEdit = (promo: Promo) => {
    setEditingPromo(promo);
    setIsDuplicate(false);
    setModalOpen(true);
  };

  const handleDelete = async (promoId: string) => {
    await deletePromo(promoId);
  };

  const handleDuplicate = (promo: Promo) => {
    setEditingPromo(promo);
    setIsDuplicate(true);
    setModalOpen(true);
  };

  const handleCancelSeries = async (groupId: string) => {
    if (!user) return;
    await cancelRecurringSeries(groupId, user.uid);
  };

  const handleOpenNew = () => {
    setEditingPromo(null);
    setIsDuplicate(false);
    setModalOpen(true);
  };

  const pastPromotingNames = Array.from(new Set(promos.map(p => p.promoting))).sort();

  const handleSavePreset = (promoterName: string, preset: PromoterPreset) => {
    updateProfile({
      promoterPresets: {
        ...(profile?.promoterPresets || {}),
        [promoterName]: preset,
      },
    });
  };

  return (
    <ProtectedRoute>
      <DashboardLayout>
        {/* Page Header */}
        <div className="flex items-center justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-xs sm:text-sm text-text-muted mt-0.5 sm:mt-1">
              Manage your promotions
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <button
              onClick={handleOpenNew}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent hover:bg-accent/90 text-white text-sm font-medium transition-all shadow-lg shadow-accent/20 hover:shadow-accent/30"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add Promo
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-text-muted text-sm">Loading data...</p>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="mb-5 sm:mb-8">
              <SummaryCards promos={promos} />
            </div>

            {/* Promo Table */}
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
              <div className="px-4 md:px-5 py-4 border-b border-white/[0.06]">
                <h2 className="text-base font-semibold text-white">
                  All Promotions
                </h2>
              </div>
              <div className="p-4 md:p-5">
                <PromoTable
                  promos={promos}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onDuplicate={handleDuplicate}
                  onCancelSeries={handleCancelSeries}
                />
              </div>
            </div>
          </>
        )}

        {/* Add/Edit/Duplicate Modal */}
        <PromoModal
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setEditingPromo(null);
            setIsDuplicate(false);
          }}
          onSave={handleSave}
          editingPromo={editingPromo}
          savedPromoters={savedPromoters}
          savedAccounts={savedAccounts}
          userId={user?.uid || ""}
          isDuplicate={isDuplicate}
          promoDefaults={profile?.defaults}
          pastPromotingNames={pastPromotingNames}
          promoterPresets={profile?.promoterPresets || {}}
          onSavePreset={handleSavePreset}
        />

        {/* Mobile FAB — Add Promo */}
        <button
          onClick={handleOpenNew}
          className="sm:hidden fixed right-4 bottom-20 z-20 w-14 h-14 rounded-full bg-accent shadow-lg shadow-accent/30 flex items-center justify-center active:scale-95 transition-transform"
          aria-label="Add Promo"
        >
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
