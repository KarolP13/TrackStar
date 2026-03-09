"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import SummaryCards from "@/components/SummaryCards";
import PromoTable from "@/components/PromoTable";
import PromoModal from "@/components/PromoModal";
import { Promo, PromoFormData, SavedPromoter, SavedAccount } from "@/lib/types";
import {
  subscribeToPromos, addPromo, updatePromo, deletePromo,
  subscribeToSavedPromoters, subscribeToSavedAccounts,
  addRecurringPromo, cancelRecurringSeries,
} from "@/lib/promos";
import { exportPromoTablePDF } from "@/lib/pdfExport";
import { exportPromosToCSV } from "@/lib/csvExport";

export default function DashboardPage() {
  const { user } = useAuth();
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

  return (
    <ProtectedRoute>
      <DashboardLayout>
        {/* Page Header */}
        <div className="flex items-center justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">Dashboard</h1>
            <p className="text-xs sm:text-sm text-white/40 mt-0.5 sm:mt-1">
              Manage your promotions
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <button
              onClick={() => exportPromosToCSV(promos)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-white/[0.08] text-white/50 hover:text-white/70 hover:bg-white/[0.04] text-sm font-medium transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 1.5v-1.5m0 0c0-.621.504-1.125 1.125-1.125m0 0h7.5" />
              </svg>
              Export CSV
            </button>
            <button
              onClick={() => exportPromoTablePDF(promos)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-white/[0.08] text-white/50 hover:text-white/70 hover:bg-white/[0.04] text-sm font-medium transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              Export PDF
            </button>
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
            <p className="text-white/40 text-sm">Loading promos...</p>
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
