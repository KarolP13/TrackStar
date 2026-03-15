"use client";

import { DateRange } from "@/lib/types";
import { useState } from "react";

export interface ExportConfig {
    dateRange: DateRange;
    includeSummary: boolean;
    includeRevenueTime: boolean;
    includePromoVolume: boolean;
    includeRevenueAccount: boolean;
    includeTopArtists: boolean;
    includePaymentStatus: boolean;
    includeLeaderboard: boolean;
}

interface AnalyticsExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onExport: (config: ExportConfig) => Promise<void>;
}

const dateRangeOptions: { value: DateRange; label: string }[] = [
    { value: "7d", label: "7 Days" },
    { value: "30d", label: "30 Days" },
    { value: "this_month", label: "This Month" },
    { value: "last_month", label: "Last Month" },
    { value: "90d", label: "90 Days" },
    { value: "all", label: "All Time" },
];

export default function AnalyticsExportModal({ isOpen, onClose, onExport }: AnalyticsExportModalProps) {
    const [config, setConfig] = useState<ExportConfig>({
        dateRange: "this_month",
        includeSummary: true,
        includeRevenueTime: true,
        includePromoVolume: true,
        includeRevenueAccount: true,
        includeTopArtists: true,
        includePaymentStatus: true,
        includeLeaderboard: true,
    });
    const [exporting, setExporting] = useState(false);

    if (!isOpen) return null;

    const handleExport = async () => {
        setExporting(true);
        try {
            await onExport(config);
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setExporting(false);
        }
    };

    const toggle = (field: keyof Omit<ExportConfig, "dateRange">) => {
        setConfig(prev => ({ ...prev, [field]: !prev[field] }));
    };

    return (
        <>
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-fade-in" onClick={onClose} />
            <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center p-4">
                <div className="pointer-events-auto w-full max-w-lg bg-background border border-border-light rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-in">
                    <div className="px-6 py-5 border-b border-border-light flex justify-between items-center">
                        <h2 className="text-lg font-bold text-foreground">Export Analytics Report</h2>
                        <button onClick={onClose} disabled={exporting} className="p-1 text-text-muted hover:text-text-secondary transition-colors disabled:opacity-50">
                            ✕
                        </button>
                    </div>

                    <div className="p-6 space-y-6">
                        {/* Time Window */}
                        <div className="space-y-3">
                            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Time Window</label>
                            <div className="flex flex-wrap gap-2">
                                {dateRangeOptions.map((opt) => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setConfig(prev => ({ ...prev, dateRange: opt.value }))}
                                        disabled={exporting}
                                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${config.dateRange === opt.value ? "bg-accent text-white shadow-lg shadow-accent/20" : "bg-surface border border-border-light text-text-secondary hover:text-foreground"}`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Sections to Include */}
                        <div className="space-y-3">
                            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Include Sections</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {[
                                    { key: "includeSummary", label: "Summary Details" },
                                    { key: "includeRevenueTime", label: "Revenue Over Time (Graph)" },
                                    { key: "includePromoVolume", label: "Promo Volume (Graph)" },
                                    { key: "includeRevenueAccount", label: "Revenue by Account" },
                                    { key: "includeTopArtists", label: "Top Artists by Spend" },
                                    { key: "includePaymentStatus", label: "Payment Status Distribution" },
                                    { key: "includeLeaderboard", label: "Promoter Leaderboard" },
                                ].map((item) => (
                                    <label key={item.key} className="flex items-center gap-2.5 cursor-pointer group col-span-1">
                                        <div className="relative flex items-center justify-center">
                                            <input
                                                type="checkbox"
                                                checked={config[item.key as keyof Omit<ExportConfig, "dateRange">] as boolean}
                                                onChange={() => toggle(item.key as keyof Omit<ExportConfig, "dateRange">)}
                                                disabled={exporting}
                                                className="appearance-none w-5 h-5 border-2 border-border-light rounded focus:outline-none checked:bg-accent checked:border-accent disabled:opacity-50 transition-colors"
                                            />
                                            {(config[item.key as keyof Omit<ExportConfig, "dateRange">] as boolean) && (
                                                <svg className="absolute w-3 h-3 text-white pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                            )}
                                        </div>
                                        <span className="text-sm text-text-secondary group-hover:text-foreground transition-colors select-none">{item.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="px-6 py-4 border-t border-border-light flex justify-end gap-3 bg-white/[0.01]">
                        <button
                            onClick={onClose}
                            disabled={exporting}
                            className="px-4 py-2 rounded-lg text-sm text-text-secondary hover:text-foreground transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleExport}
                            disabled={exporting}
                            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-all shadow-lg shadow-accent/20 disabled:opacity-50"
                        >
                            {exporting ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Generating PDF...
                                </>
                            ) : (
                                "Export Report"
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
