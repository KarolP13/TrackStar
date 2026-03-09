"use client";

import { Promo } from "@/lib/types";

interface SummaryCardsProps {
    promos: Promo[];
    onFilterStatus: (status: string) => void;
    currentFilter: string;
}

export default function SummaryCards({ promos, onFilterStatus, currentFilter }: SummaryCardsProps) {
    const totalPromos = promos.length;
    const totalRevenue = promos.reduce((sum, p) => sum + p.paymentAmount, 0);
    const pendingCount = promos.filter((p) => p.paymentStatus === "Pending").length;
    const paidCount = promos.filter((p) => p.paymentStatus === "Paid").length;

    const cards = [
        {
            label: "Total Promos",
            value: totalPromos.toString(),
            icon: (
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
                </svg>
            ),
            color: "text-accent",
            bg: "bg-accent/10",
            filterVal: "All"
        },
        {
            label: "Revenue",
            value: `$${totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
            icon: (
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            ),
            color: "text-emerald-400",
            bg: "bg-emerald-400/10",
        },
        {
            label: "Pending",
            value: pendingCount.toString(),
            icon: (
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            ),
            color: "text-amber-400",
            bg: "bg-amber-400/10",
            filterVal: "Pending"
        },
        {
            label: "Paid",
            value: paidCount.toString(),
            icon: (
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            ),
            color: "text-green-400",
            bg: "bg-green-400/10",
            filterVal: "Paid"
        },
    ];

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {cards.map((card) => {
                const isSelected = card.filterVal && currentFilter === card.filterVal;
                return (
                    <div
                        key={card.label}
                        onClick={() => card.filterVal && onFilterStatus(card.filterVal)}
                        className={`bg-surface border rounded-xl p-3.5 sm:p-5 transition-all duration-300 group
                            ${card.filterVal ? "cursor-pointer hover:bg-surface-hover hover:border-accent/50 selection:bg-none" : ""} 
                            ${isSelected ? "border-accent/50 bg-accent/5 ring-1 ring-accent/20" : "border-border-light"}
                        `}
                    >
                        <div className="flex items-center justify-between mb-2 sm:mb-3">
                            <span className="text-[10px] sm:text-xs text-text-muted uppercase tracking-wider font-medium">
                                {card.label}
                            </span>
                            <div className={`${card.bg} ${card.color} p-1.5 sm:p-2 rounded-lg`}>
                                {card.icon}
                            </div>
                        </div>
                        <p className={`text-lg sm:text-2xl font-bold ${card.color}`}>{card.value}</p>
                    </div>
                );
            })}
        </div>
    );
}
