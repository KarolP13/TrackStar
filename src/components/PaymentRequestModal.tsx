"use client";

import { useState, useMemo } from "react";
import { Promo, PromoterPreset } from "@/lib/types";
import { bulkUpdateStatus } from "@/lib/promos";

interface PaymentRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    promos: Promo[];
    preSelectedPromoter?: string;
    promoterPresets?: Record<string, PromoterPreset>;
}

export default function PaymentRequestModal({
    isOpen,
    onClose,
    promos,
    preSelectedPromoter,
    promoterPresets = {},
}: PaymentRequestModalProps) {
    const [selectedPromoter, setSelectedPromoter] = useState<string | null>(preSelectedPromoter || null);
    const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
    const [copied, setCopied] = useState(false);
    const [marking, setMarking] = useState(false);
    const [markDone, setMarkDone] = useState(false);

    // Toggle switches
    const [showAmounts, setShowAmounts] = useState(false);
    const [showTotal, setShowTotal] = useState(false);
    const [showPromoterName, setShowPromoterName] = useState(false);
    const [showPaymentMethod, setShowPaymentMethod] = useState(false);
    const [showTitle, setShowTitle] = useState(false);

    // Promoters with pending promos
    const promotersWithPending = useMemo(() => {
        const map: Record<string, { count: number; total: number }> = {};
        promos.forEach((p) => {
            if (p.paymentStatus !== "Pending") return;
            if (!map[p.promoterName]) map[p.promoterName] = { count: 0, total: 0 };
            map[p.promoterName].count += 1;
            map[p.promoterName].total += p.paymentAmount;
        });
        return Object.entries(map)
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.total - a.total);
    }, [promos]);

    // Pending promos for selected promoter
    const pendingPromos = useMemo(() => {
        if (!selectedPromoter) return [];
        return promos
            .filter((p) => p.promoterName === selectedPromoter && p.paymentStatus === "Pending" && p.id)
            .sort((a, b) => (a.promoDate?.toMillis() || 0) - (b.promoDate?.toMillis() || 0));
    }, [promos, selectedPromoter]);

    // Initialize checked IDs when promoter changes
    const handleSelectPromoter = (name: string) => {
        setSelectedPromoter(name);
        const ids = promos
            .filter((p) => p.promoterName === name && p.paymentStatus === "Pending" && p.id)
            .map((p) => p.id!);
        setCheckedIds(new Set(ids));
        setMarkDone(false);
    };

    // Selected pending promos
    const selectedPromos = pendingPromos.filter((p) => p.id && checkedIds.has(p.id));

    // Grouped artist tallies
    const artistTallies = useMemo(() => {
        const map: Record<string, { count: number; amount: number }> = {};
        selectedPromos.forEach((p) => {
            const artist = p.promoting || "Unknown";
            if (!map[artist]) map[artist] = { count: 0, amount: 0 };
            map[artist].count += 1;
            map[artist].amount += p.paymentAmount;
        });
        return Object.entries(map)
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.count - a.count);
    }, [selectedPromos]);

    // Date range
    const dateRange = useMemo(() => {
        if (selectedPromos.length === 0) return "";
        const dates = selectedPromos
            .map((p) => p.promoDate?.toDate())
            .filter(Boolean) as Date[];
        if (dates.length === 0) return "";
        const min = new Date(Math.min(...dates.map((d) => d.getTime())));
        const max = new Date(Math.max(...dates.map((d) => d.getTime())));
        const fmt = (d: Date) =>
            d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        return `${fmt(min)} – ${fmt(max)}`;
    }, [selectedPromos]);

    // Total
    const totalAmount = selectedPromos.reduce((s, p) => s + p.paymentAmount, 0);

    // Generate text
    const generatedText = useMemo(() => {
        if (selectedPromos.length === 0) return "";
        const lines: string[] = [];

        if (showTitle) lines.push("Payment Request — TrackStar");
        if (showPromoterName && selectedPromoter) lines.push(`Promoter: ${selectedPromoter}`);
        if (dateRange) lines.push(dateRange);

        artistTallies.forEach(({ name, count, amount }) => {
            let line = `${name} × ${count}`;
            if (showAmounts) line += ` — $${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
            lines.push(line);
        });

        if (showTotal) {
            lines.push(`Total: $${totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`);
        }
        if (showPaymentMethod && selectedPromoter) {
            const preset = promoterPresets[selectedPromoter];
            if (preset?.paymentMethod) {
                lines.push(`Payment method: ${preset.paymentMethod}`);
            }
        }

        return lines.join("\n");
    }, [selectedPromos, artistTallies, dateRange, totalAmount, showAmounts, showTotal, showPromoterName, showPaymentMethod, showTitle, selectedPromoter, promoterPresets]);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(generatedText);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Fallback
            const textarea = document.createElement("textarea");
            textarea.value = generatedText;
            textarea.style.position = "fixed";
            textarea.style.opacity = "0";
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand("copy");
            document.body.removeChild(textarea);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleMarkAsPaid = async () => {
        if (selectedIds.length === 0) return;
        const count = selectedIds.length;
        if (!confirm(`Mark ${count} promo${count !== 1 ? "s" : ""} from ${selectedPromoter} as Paid?`)) return;
        setMarking(true);
        try {
            await bulkUpdateStatus(selectedIds, "Paid");
            setMarkDone(true);
            setCheckedIds(new Set());
        } catch (err) {
            console.error("Failed to mark as paid:", err);
        } finally {
            setMarking(false);
        }
    };

    const selectedIds = Array.from(checkedIds);

    const toggleCheck = (id: string) => {
        setCheckedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // Reset when opening/closing
    const handleClose = () => {
        setSelectedPromoter(preSelectedPromoter || null);
        setCheckedIds(new Set());
        setCopied(false);
        setMarking(false);
        setMarkDone(false);
        setShowAmounts(false);
        setShowTotal(false);
        setShowPromoterName(false);
        setShowPaymentMethod(false);
        setShowTitle(false);
        onClose();
    };

    // Auto-select promoter if pre-selected
    useMemo(() => {
        if (isOpen && preSelectedPromoter && !selectedPromoter) {
            handleSelectPromoter(preSelectedPromoter);
        }
    }, [isOpen, preSelectedPromoter]);

    if (!isOpen) return null;

    const ToggleSwitch = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
        <label className="flex items-center justify-between gap-3 cursor-pointer group">
            <span className="text-sm text-text-secondary group-hover:text-foreground transition-colors">{label}</span>
            <button
                type="button"
                onClick={() => onChange(!checked)}
                className="flex-shrink-0"
            >
                <div className={`w-9 h-5 rounded-full relative transition-colors ${checked ? "bg-accent" : "bg-surface-hover"}`}>
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? "left-4" : "left-0.5"}`} />
                </div>
            </button>
        </label>
    );

    return (
        <>
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-fade-in" onClick={handleClose} />
            <div className="fixed inset-0 z-50 pointer-events-none">
                <div className="pointer-events-auto absolute inset-0 md:inset-auto md:top-6 md:right-6 w-full md:w-[520px] h-[100dvh] md:h-auto md:max-h-[85vh] md:rounded-2xl bg-background md:border border-border-light shadow-2xl flex flex-col overflow-hidden animate-slide-in">
                    {/* Header */}
                    <div className="relative flex items-center justify-center px-5 sm:px-6 h-[72px] sm:h-[80px] border-b border-border-light shrink-0 safe-area-top">
                        <h2 className="absolute left-1/2 -translate-x-1/2 text-lg font-semibold text-foreground text-center whitespace-nowrap">
                            Payment Request
                        </h2>
                        {selectedPromoter && (
                            <button
                                onClick={() => { setSelectedPromoter(null); setCheckedIds(new Set()); setMarkDone(false); }}
                                className="absolute left-5 sm:left-6 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors p-1 text-sm"
                            >
                                ← Back
                            </button>
                        )}
                        <button
                            onClick={handleClose}
                            className="absolute right-5 sm:right-6 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors p-1"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 sm:py-5 space-y-4">
                        {!selectedPromoter ? (
                            /* Step 1: Select Promoter */
                            <div className="space-y-3 animate-fade-in">
                                <p className="text-xs text-text-muted uppercase tracking-wider font-medium">Select a promoter</p>
                                {promotersWithPending.length === 0 ? (
                                    <p className="text-sm text-text-muted py-8 text-center">No promoters with pending promos.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {promotersWithPending.map((p) => (
                                            <button
                                                key={p.name}
                                                onClick={() => handleSelectPromoter(p.name)}
                                                className="w-full text-left px-4 py-3 bg-surface border border-border-light rounded-xl hover:bg-surface-hover hover:border-accent/30 transition-all group"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm font-medium text-foreground group-hover:text-accent transition-colors">{p.name}</span>
                                                    <svg className="w-4 h-4 text-text-muted group-hover:text-accent transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                                                    </svg>
                                                </div>
                                                <p className="text-xs text-text-muted mt-1">
                                                    <span className="text-accent font-medium">${p.total.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                                                    {" "}pending ({p.count} promo{p.count !== 1 ? "s" : ""})
                                                </p>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* Step 2: Review & Generate */
                            <div className="space-y-4 animate-fade-in">
                                {markDone ? (
                                    <div className="flex flex-col items-center justify-center py-8 gap-3 animate-fade-in">
                                        <div className="w-12 h-12 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                                            <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                            </svg>
                                        </div>
                                        <p className="text-sm text-foreground font-medium">Promos marked as Paid!</p>
                                        <button onClick={handleClose} className="text-xs text-accent hover:text-accent/80 transition-colors">Close</button>
                                    </div>
                                ) : (
                                    <>
                                        {/* Breakdown table */}
                                        <div>
                                            <p className="text-xs text-text-muted uppercase tracking-wider font-medium mb-2">
                                                Pending promos for <span className="text-accent">{selectedPromoter}</span>
                                            </p>
                                            <div className="max-h-48 overflow-y-auto border border-border-light rounded-xl">
                                                <table className="w-full text-sm">
                                                    <thead className="sticky top-0 bg-surface">
                                                        <tr className="border-b border-border-light">
                                                            <th className="px-3 py-2 text-left w-8">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={pendingPromos.length > 0 && pendingPromos.every((p) => p.id && checkedIds.has(p.id))}
                                                                    onChange={() => {
                                                                        const allChecked = pendingPromos.every((p) => p.id && checkedIds.has(p.id));
                                                                        if (allChecked) {
                                                                            setCheckedIds(new Set());
                                                                        } else {
                                                                            setCheckedIds(new Set(pendingPromos.map((p) => p.id!).filter(Boolean)));
                                                                        }
                                                                    }}
                                                                    className="w-3.5 h-3.5 rounded border-border-light accent-accent cursor-pointer"
                                                                />
                                                            </th>
                                                            <th className="px-2 py-2 text-left text-xs text-text-muted font-medium">Date</th>
                                                            <th className="px-2 py-2 text-left text-xs text-text-muted font-medium">Artist</th>
                                                            <th className="px-2 py-2 text-left text-xs text-text-muted font-medium">Account</th>
                                                            <th className="px-2 py-2 text-right text-xs text-text-muted font-medium">Amount</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {pendingPromos.map((p) => (
                                                            <tr key={p.id} className="border-b border-border-light/50 hover:bg-surface-hover transition-colors">
                                                                <td className="px-3 py-2">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={!!p.id && checkedIds.has(p.id)}
                                                                        onChange={() => p.id && toggleCheck(p.id)}
                                                                        className="w-3.5 h-3.5 rounded border-border-light accent-accent cursor-pointer"
                                                                    />
                                                                </td>
                                                                <td className="px-2 py-2 text-text-muted text-xs">
                                                                    {p.promoDate?.toDate().toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                                                </td>
                                                                <td className="px-2 py-2 text-foreground text-xs font-medium">{p.promoting}</td>
                                                                <td className="px-2 py-2 text-text-muted text-xs font-mono">{p.accountHandle}</td>
                                                                <td className="px-2 py-2 text-right text-foreground text-xs font-medium">
                                                                    ${p.paymentAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                            <p className="text-xs text-text-muted mt-1.5">
                                                {selectedPromos.length} of {pendingPromos.length} selected — Total:{" "}
                                                <span className="text-accent font-medium">${totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                                            </p>
                                        </div>

                                        {/* Toggle Switches */}
                                        <div className="space-y-2.5 px-4 py-3 bg-surface border border-border-light rounded-xl">
                                            <p className="text-xs text-text-muted uppercase tracking-wider font-medium mb-1">Options</p>
                                            <ToggleSwitch label="Show amounts per artist" checked={showAmounts} onChange={setShowAmounts} />
                                            <ToggleSwitch label="Show total" checked={showTotal} onChange={setShowTotal} />
                                            <ToggleSwitch label="Show promoter name" checked={showPromoterName} onChange={setShowPromoterName} />
                                            <ToggleSwitch label="Show payment method" checked={showPaymentMethod} onChange={setShowPaymentMethod} />
                                            <ToggleSwitch label="Show title header" checked={showTitle} onChange={setShowTitle} />
                                        </div>

                                        {/* Generated Text */}
                                        {selectedPromos.length > 0 && (
                                            <div className="space-y-2">
                                                <p className="text-xs text-text-muted uppercase tracking-wider font-medium">Generated Text</p>
                                                <div className="relative">
                                                    <textarea
                                                        readOnly
                                                        value={generatedText}
                                                        rows={Math.min(12, generatedText.split("\n").length + 1)}
                                                        className="w-full bg-surface border border-border-light rounded-xl px-4 py-3 text-sm text-foreground font-mono resize-none focus:outline-none"
                                                    />
                                                    <button
                                                        onClick={handleCopy}
                                                        className={`absolute top-2 right-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                                            copied
                                                                ? "bg-green-500/20 text-green-400 border border-green-500/30"
                                                                : "bg-accent text-white shadow-lg shadow-accent/25 hover:bg-accent/90"
                                                        }`}
                                                    >
                                                        {copied ? (
                                                            <>
                                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                                                </svg>
                                                                Copied!
                                                            </>
                                                        ) : (
                                                            <>
                                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                                                                </svg>
                                                                Copy
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Mark as Paid */}
                                        {selectedPromos.length > 0 && (
                                            <button
                                                onClick={handleMarkAsPaid}
                                                disabled={marking}
                                                className="w-full py-2.5 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 text-sm font-medium hover:bg-green-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                            >
                                                {marking ? (
                                                    <div className="w-4 h-4 border-2 border-green-400/30 border-t-green-400 rounded-full animate-spin" />
                                                ) : (
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                )}
                                                Mark {selectedPromos.length} selected as Paid
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
