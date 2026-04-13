"use client";

import { Promo } from "@/lib/types";

interface PendingSummaryBarProps {
    promos: Promo[];
    filterStatus: string;
    filterPromoter: string;
    onGenerateRequest: (promoterName?: string) => void;
}

export default function PendingSummaryBar({
    promos,
    filterStatus,
    filterPromoter,
    onGenerateRequest,
}: PendingSummaryBarProps) {
    // Only show when status filter is "Pending"
    if (filterStatus !== "Pending") return null;

    const pendingPromos = promos.filter((p) => p.paymentStatus === "Pending");

    if (pendingPromos.length === 0) return null;

    // Single promoter selected
    if (filterPromoter && filterPromoter !== "All") {
        const promoterPromos = pendingPromos.filter((p) => p.promoterName === filterPromoter);
        const total = promoterPromos.reduce((sum, p) => sum + p.paymentAmount, 0);
        const count = promoterPromos.length;

        if (count === 0) return null;

        return (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-4 py-3 bg-amber-500/5 border border-amber-500/15 rounded-xl animate-fade-in">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">{filterPromoter}</span>
                    <span className="text-sm text-text-muted">—</span>
                    <span className="text-sm text-text-secondary">
                        Total Pending:{" "}
                        <span className="text-accent font-semibold">
                            ${total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </span>
                    </span>
                    <span className="text-xs text-text-muted">({count} promo{count !== 1 ? "s" : ""})</span>
                </div>
                <button
                    onClick={() => onGenerateRequest(filterPromoter)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/10 text-accent text-xs font-medium hover:bg-accent/20 transition-all border border-accent/20"
                >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                    Generate Request
                </button>
            </div>
        );
    }

    // No promoter filter — show overall pending total
    const total = pendingPromos.reduce((sum, p) => sum + p.paymentAmount, 0);
    const count = pendingPromos.length;

    // Check if there are multiple promoters in pending
    const promoterGroups: Record<string, { total: number; count: number }> = {};
    pendingPromos.forEach((p) => {
        if (!promoterGroups[p.promoterName]) {
            promoterGroups[p.promoterName] = { total: 0, count: 0 };
        }
        promoterGroups[p.promoterName].total += p.paymentAmount;
        promoterGroups[p.promoterName].count += 1;
    });

    const promoterNames = Object.keys(promoterGroups);

    // Multiple promoters — show breakdown
    if (promoterNames.length > 1) {
        return (
            <div className="flex flex-col gap-2 px-4 py-3 bg-amber-500/5 border border-amber-500/15 rounded-xl animate-fade-in">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    {promoterNames.sort().map((name, i) => (
                        <span key={name} className="inline-flex items-center gap-1">
                            {i > 0 && <span className="text-text-muted mx-1">·</span>}
                            <span className="text-text-secondary">{name}:</span>
                            <span className="text-accent font-medium">
                                ${promoterGroups[name].total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            </span>
                            <span className="text-text-muted text-xs">({promoterGroups[name].count})</span>
                        </span>
                    ))}
                    <span className="text-text-muted mx-1">·</span>
                    <span className="text-text-secondary font-medium">
                        Total: <span className="text-accent font-semibold">${total.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                    </span>
                    <span className="text-text-muted text-xs">({count})</span>
                </div>
            </div>
        );
    }

    // Single or no promoter distinction — simple total
    return (
        <div className="flex items-center justify-between gap-2 px-4 py-3 bg-amber-500/5 border border-amber-500/15 rounded-xl animate-fade-in">
            <span className="text-sm text-text-secondary">
                Total Pending:{" "}
                <span className="text-accent font-semibold">
                    ${total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
                <span className="text-text-muted text-xs ml-1.5">({count} promo{count !== 1 ? "s" : ""})</span>
            </span>
        </div>
    );
}
