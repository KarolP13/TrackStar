"use client";

import { useState, useEffect } from "react";
import { Promo, PromoFormData, SavedPromoter, SavedAccount, PAYMENT_METHODS, PAYMENT_STATUSES, RECURRING_FREQUENCIES, PromoDefaults, PromoterPreset } from "@/lib/types";
import { addSavedPromoter, deleteSavedPromoter, addSavedAccount, deleteSavedAccount } from "@/lib/promos";

interface PromoModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: PromoFormData) => Promise<void>;
    editingPromo?: Promo | null;
    savedPromoters: SavedPromoter[];
    savedAccounts: SavedAccount[];
    userId: string;
    isDuplicate?: boolean;
    promoDefaults?: PromoDefaults;
    pastPromotingNames?: string[];
    promoterPresets?: Record<string, PromoterPreset>;
    onSavePreset?: (promoterName: string, preset: PromoterPreset) => void;
}

const defaultFormData: PromoFormData = {
    promoting: "",
    promoterName: "",
    accountHandle: "",
    promoDate: new Date().toISOString().split("T")[0],
    tweetLink: "",
    paymentMethod: "PayPal",
    paymentAmount: 0,
    paymentStatus: "Paid",
    notes: "",
    isRecurring: false,
    recurringFrequency: null,
    recurringEndType: null,
    recurringEndValue: null,
    recurringGroupId: null,
    isRecurringParent: false,
    isBundle: false,
    bundleCount: null,
    bundleIndex: null,
    impressions: null,
    likes: null,
    comments: null,
    bookmarks: null,
    retweets: null,
};

export default function PromoModal({
    isOpen,
    onClose,
    onSave,
    editingPromo,
    savedPromoters,
    savedAccounts,
    userId,
    isDuplicate,
    promoDefaults,
    pastPromotingNames = [],
    promoterPresets = {},
    onSavePreset,
}: PromoModalProps) {
    const [formData, setFormData] = useState<PromoFormData>({ ...defaultFormData });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [newPromoterName, setNewPromoterName] = useState("");
    const [showAddPromoter, setShowAddPromoter] = useState(false);
    const [newAccountHandle, setNewAccountHandle] = useState("");
    const [showAddAccount, setShowAddAccount] = useState(false);
    const [showRecurring, setShowRecurring] = useState(false);
    const [saveAsDefault, setSaveAsDefault] = useState(false);
    const [promotingSuggestion, setPromotingSuggestion] = useState("");

    useEffect(() => {
        if (editingPromo) {
            setFormData({
                promoting: editingPromo.promoting,
                promoterName: editingPromo.promoterName,
                accountHandle: editingPromo.accountHandle,
                promoDate: isDuplicate
                    ? new Date().toISOString().split("T")[0]
                    : editingPromo.promoDate?.toDate
                        ? editingPromo.promoDate.toDate().toISOString().split("T")[0]
                        : new Date().toISOString().split("T")[0],
                tweetLink: isDuplicate ? "" : (editingPromo.tweetLink || ""),
                paymentMethod: editingPromo.paymentMethod,
                paymentAmount: editingPromo.paymentAmount,
                paymentStatus: isDuplicate ? "Paid" : editingPromo.paymentStatus,
                notes: editingPromo.notes || "",
                isRecurring: isDuplicate ? false : (editingPromo.isRecurring || false),
                recurringFrequency: isDuplicate ? null : (editingPromo.recurringFrequency || null),
                recurringEndType: isDuplicate ? null : (editingPromo.recurringEndType || null),
                recurringEndValue: isDuplicate ? null : (editingPromo.recurringEndValue || null),
                recurringGroupId: isDuplicate ? null : (editingPromo.recurringGroupId || null),
                isRecurringParent: isDuplicate ? false : (editingPromo.isRecurringParent || false),
                isBundle: editingPromo.isBundle || false,
                bundleCount: editingPromo.bundleCount || null,
                bundleIndex: editingPromo.bundleIndex || null,
                impressions: editingPromo.impressions ?? null,
                likes: editingPromo.likes ?? null,
                comments: editingPromo.comments ?? null,
                bookmarks: editingPromo.bookmarks ?? null,
                retweets: editingPromo.retweets ?? null,
            });
            setShowRecurring(!isDuplicate && (editingPromo.isRecurring || false));
        } else {
            setFormData({
                ...defaultFormData,
                paymentMethod: promoDefaults?.paymentMethod || defaultFormData.paymentMethod,
                accountHandle: promoDefaults?.accountHandle || defaultFormData.accountHandle,
                promoterName: promoDefaults?.promoterName || defaultFormData.promoterName,
            });
            setShowRecurring(false);
        }
        setError("");
        setShowAddPromoter(false);
        setNewPromoterName("");
        setShowAddAccount(false);
        setNewAccountHandle("");
        setSaveAsDefault(false);
    }, [editingPromo, isOpen, isDuplicate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.promoting.trim() || !formData.promoterName.trim() || !formData.accountHandle.trim()) {
            setError("Please fill in all required fields.");
            return;
        }
        if (formData.tweetLink && !formData.tweetLink.startsWith("http")) {
            setError("Tweet link must be a valid URL starting with http or https.");
            return;
        }
        setLoading(true);
        setError("");
        try {
            // Save promoter preset if checkbox is checked
            if (saveAsDefault && formData.promoterName.trim() && onSavePreset) {
                onSavePreset(formData.promoterName.trim(), {
                    paymentMethod: formData.paymentMethod,
                    amount: formData.paymentAmount || null,
                });
            }
            await onSave(formData);
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save promo.");
        } finally {
            setLoading(false);
        }
    };

    const handleAddPromoter = async () => {
        const name = newPromoterName.trim();
        if (!name) return;
        try {
            await addSavedPromoter(userId, name);
            setFormData({ ...formData, promoterName: name });
            setNewPromoterName("");
            setShowAddPromoter(false);
        } catch {
            setError("Failed to save promoter.");
        }
    };

    const handleDeletePromoter = async (promoter: SavedPromoter) => {
        if (promoter.id && confirm(`Remove "${promoter.name}" from saved promoters?`)) {
            await deleteSavedPromoter(promoter.id);
            if (formData.promoterName === promoter.name) {
                setFormData({ ...formData, promoterName: "" });
            }
        }
    };

    const handleAddAccount = async () => {
        const handle = newAccountHandle.trim();
        if (!handle) return;
        try {
            await addSavedAccount(userId, handle);
            setFormData({ ...formData, accountHandle: handle });
            setNewAccountHandle("");
            setShowAddAccount(false);
        } catch {
            setError("Failed to save account.");
        }
    };

    const handleDeleteAccount = async (account: SavedAccount) => {
        if (account.id && confirm(`Remove "${account.handle}" from saved accounts?`)) {
            await deleteSavedAccount(account.id);
            if (formData.accountHandle === account.handle) {
                setFormData({ ...formData, accountHandle: "" });
            }
        }
    };

    const toggleRecurring = (enabled: boolean) => {
        setShowRecurring(enabled);
        setFormData({
            ...formData,
            isRecurring: enabled,
            recurringFrequency: enabled ? "weekly" : null,
            recurringEndType: enabled ? "never" : null,
            recurringEndValue: enabled ? null : null,
            isRecurringParent: enabled,
        });
    };

    const handlePromotingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setFormData({ ...formData, promoting: val });

        if (val.trim() === "") {
            setPromotingSuggestion("");
        } else {
            const match = pastPromotingNames.find(n => n.toLowerCase().startsWith(val.toLowerCase()));
            if (match && match.toLowerCase() !== val.toLowerCase()) {
                setPromotingSuggestion(val + match.substring(val.length));
            } else {
                setPromotingSuggestion("");
            }
        }
    };

    const handlePromotingKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Tab" && promotingSuggestion) {
            e.preventDefault();
            setFormData({ ...formData, promoting: promotingSuggestion });
            setPromotingSuggestion("");
        } else if (e.key === "ArrowRight" && promotingSuggestion) {
            const input = e.currentTarget;
            if (input.selectionStart === formData.promoting.length) {
                e.preventDefault();
                setFormData({ ...formData, promoting: promotingSuggestion });
                setPromotingSuggestion("");
            }
        } else if (e.key === "Escape") {
            setPromotingSuggestion("");
        }
    };

    // Auto-fill payment from promoter preset when promoter changes
    const handlePromoterChange = (name: string) => {
        const preset = promoterPresets[name];
        if (preset && !editingPromo) {
            setFormData(prev => ({
                ...prev,
                promoterName: name,
                paymentMethod: preset.paymentMethod || prev.paymentMethod,
                paymentAmount: preset.amount ?? prev.paymentAmount,
            }));
        } else {
            setFormData(prev => ({ ...prev, promoterName: name }));
        }
    };

    if (!isOpen) return null;

    const modalTitle = isDuplicate
        ? "Duplicate Promo"
        : editingPromo
            ? "Edit Promo"
            : "Add New Promo";

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-fade-in"
                onClick={onClose}
            />

            {/* Slide-over / Full-screen Panel */}
            <div className="fixed inset-0 z-50 pointer-events-none">
                <div className="pointer-events-auto fixed inset-0 md:inset-auto md:top-6 md:right-6 w-full md:w-[480px] h-[100dvh] md:h-auto md:max-h-[85vh] md:rounded-2xl bg-background md:border border-border-light shadow-2xl flex flex-col overflow-hidden animate-slide-in">
                    {/* Header */}
                    <div className="relative flex items-center justify-center px-5 sm:px-6 py-5 sm:py-6 border-b border-border-light safe-area-top">
                        <h2 className="text-lg font-semibold text-foreground">
                            {modalTitle}
                        </h2>
                        <button
                            onClick={onClose}
                            className="absolute right-5 sm:right-6 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors p-1"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Form */}
                    <form
                        onSubmit={handleSubmit}
                        className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 sm:py-5 space-y-4 sm:space-y-5"
                    >
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400 animate-fade-in">
                                {error}
                            </div>
                        )}

                        {/* Promoting */}
                        <div>
                            <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider font-medium">
                                Promoting <span className="text-red-400">*</span>
                            </label>
                            <div className="relative flex items-center">
                                <div className="absolute inset-0 bg-surface rounded-lg pointer-events-none z-0"></div>
                                <input
                                    type="text"
                                    list="promoting-suggestions"
                                    value={formData.promoting}
                                    onChange={handlePromotingChange}
                                    onKeyDown={handlePromotingKeyDown}
                                    onBlur={() => setTimeout(() => setPromotingSuggestion(""), 150)}
                                    placeholder="e.g. Drake, Nike Campaign, New Album"
                                    className="w-full bg-transparent border border-border-light rounded-lg px-4 py-2.5 text-sm text-foreground placeholder-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25 transition-all relative z-10"
                                    autoComplete="off"
                                />
                                {promotingSuggestion && formData.promoting && promotingSuggestion.toLowerCase().startsWith(formData.promoting.toLowerCase()) && (
                                    <div className="absolute inset-y-0 left-4 right-4 flex items-center pointer-events-none overflow-hidden whitespace-pre text-sm z-20">
                                        <span className="opacity-0">{formData.promoting}</span>
                                        <span className="text-text-muted opacity-60">{promotingSuggestion.slice(formData.promoting.length)}</span>
                                    </div>
                                )}
                            </div>
                            <datalist id="promoting-suggestions">
                                {pastPromotingNames.map((name) => (
                                    <option key={name} value={name} />
                                ))}
                            </datalist>
                        </div>

                        {/* Promoter */}
                        <div>
                            <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider font-medium">
                                Promoter <span className="text-red-400">*</span>
                            </label>
                            {savedPromoters.length > 0 ? (
                                <div className="space-y-2">
                                    <div className="flex gap-2">
                                        <select
                                            value={formData.promoterName}
                                            onChange={(e) => handlePromoterChange(e.target.value)}
                                            className="flex-1 bg-surface border border-border-light rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent/50 appearance-none cursor-pointer transition-all"
                                        >
                                            <option value="">Select a promoter...</option>
                                            {savedPromoters.map((p) => (
                                                <option key={p.id} value={p.name}>{p.name}</option>
                                            ))}
                                        </select>
                                        <button type="button" onClick={() => setShowAddPromoter(!showAddPromoter)} className="px-3 py-2.5 rounded-lg border border-border-light text-text-muted hover:text-accent hover:border-accent/30 transition-all" title="Add new promoter">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {savedPromoters.map((p) => (
                                            <span key={p.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface border border-border-light text-xs text-text-muted">
                                                {p.name}
                                                <button type="button" onClick={() => handleDeletePromoter(p)} className="text-text-muted opacity-50 hover:text-red-400 transition-colors">×</button>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <input type="text" value={formData.promoterName} onChange={(e) => handlePromoterChange(e.target.value)} placeholder="Who ran the promo?" className="w-full bg-surface border border-border-light rounded-lg px-4 py-2.5 text-sm text-foreground placeholder-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25 transition-all" />
                                    <button type="button" onClick={() => setShowAddPromoter(true)} className="text-xs text-accent/60 hover:text-accent transition-colors">+ Save as a promoter for quick access</button>
                                </div>
                            )}
                            {showAddPromoter && (
                                <div className="flex gap-2 mt-2 animate-fade-in">
                                    <input type="text" value={newPromoterName} onChange={(e) => setNewPromoterName(e.target.value)} placeholder="New promoter name" className="flex-1 bg-surface border border-border-light rounded-lg px-3 py-2 text-sm text-foreground placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddPromoter(); } }} />
                                    <button type="button" onClick={handleAddPromoter} className="px-3 py-2 rounded-lg bg-accent/20 text-accent text-sm font-medium hover:bg-accent/30 transition-all">Save</button>
                                </div>
                            )}
                        </div>

                        {/* Account Handle */}
                        <div>
                            <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider font-medium">
                                Account Handle <span className="text-red-400">*</span>
                            </label>
                            {savedAccounts.length > 0 ? (
                                <div className="space-y-2">
                                    <div className="flex gap-2">
                                        <select value={formData.accountHandle} onChange={(e) => setFormData({ ...formData, accountHandle: e.target.value })} className="flex-1 bg-surface border border-border-light rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent/50 appearance-none cursor-pointer transition-all font-mono">
                                            <option value="">Select an account...</option>
                                            {savedAccounts.map((a) => (<option key={a.id} value={a.handle}>{a.handle}</option>))}
                                        </select>
                                        <button type="button" onClick={() => setShowAddAccount(!showAddAccount)} className="px-3 py-2.5 rounded-lg border border-border-light text-text-muted hover:text-accent hover:border-accent/30 transition-all" title="Add new account">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {savedAccounts.map((a) => (
                                            <span key={a.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface border border-border-light text-xs text-text-muted font-mono">
                                                {a.handle}
                                                <button type="button" onClick={() => handleDeleteAccount(a)} className="text-text-muted opacity-50 hover:text-red-400 transition-colors">×</button>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <input type="text" value={formData.accountHandle} onChange={(e) => setFormData({ ...formData, accountHandle: e.target.value })} placeholder="e.g. @songsgohard" className="w-full bg-surface border border-border-light rounded-lg px-4 py-2.5 text-sm text-foreground placeholder-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25 transition-all font-mono" />
                                    <button type="button" onClick={() => setShowAddAccount(true)} className="text-xs text-accent/60 hover:text-accent transition-colors">+ Save as an account for quick access</button>
                                </div>
                            )}
                            {showAddAccount && (
                                <div className="flex gap-2 mt-2 animate-fade-in">
                                    <input type="text" value={newAccountHandle} onChange={(e) => setNewAccountHandle(e.target.value)} placeholder="e.g. @songsgohard" className="flex-1 bg-surface border border-border-light rounded-lg px-3 py-2 text-sm text-foreground placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all font-mono" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddAccount(); } }} />
                                    <button type="button" onClick={handleAddAccount} className="px-3 py-2 rounded-lg bg-accent/20 text-accent text-sm font-medium hover:bg-accent/30 transition-all">Save</button>
                                </div>
                            )}
                        </div>

                        {/* Link */}
                        <div>
                            <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider font-medium">
                                Link <span className="text-text-muted opacity-50">(optional)</span>
                            </label>
                            <input type="url" value={formData.tweetLink} onChange={(e) => setFormData({ ...formData, tweetLink: e.target.value })} placeholder="https://x.com/..." className="w-full bg-surface border border-border-light rounded-lg px-4 py-2.5 text-sm text-foreground placeholder-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25 transition-all font-mono" />
                        </div>

                        {/* Engagement Metrics */}
                        <div>
                            <label className="block text-xs text-text-muted mb-2 uppercase tracking-wider font-medium">
                                Engagement Metrics <span className="text-text-muted opacity-50">(optional)</span>
                            </label>
                            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                                {(["impressions", "likes", "comments", "bookmarks", "retweets"] as const).map((metric) => (
                                    <div key={metric} className="flex flex-col gap-1">
                                        <span className="text-[10px] text-text-muted capitalize text-center">{metric === "retweets" ? "Reposts" : metric.charAt(0).toUpperCase() + metric.slice(1)}</span>
                                        <input
                                            type="number"
                                            min="0"
                                            value={formData[metric] ?? ""}
                                            onChange={(e) => setFormData({ ...formData, [metric]: e.target.value === "" ? null : parseInt(e.target.value) || 0 })}
                                            placeholder="—"
                                            className="w-full bg-surface border border-border-light rounded-lg px-2 py-2 text-sm text-foreground text-center focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25 transition-all placeholder-text-muted"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Promo Date */}
                        <div>
                            <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider font-medium">Promo Date</label>
                            <input type="date" value={formData.promoDate} onChange={(e) => setFormData({ ...formData, promoDate: e.target.value })} className="w-full bg-surface border border-border-light rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25 transition-all" />
                        </div>

                        {/* Payment Method + Amount */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider font-medium">Payment Method</label>
                                <select value={formData.paymentMethod} onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })} className="w-full bg-surface border border-border-light rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent/50 appearance-none cursor-pointer transition-all">
                                    {PAYMENT_METHODS.map((m) => (<option key={m} value={m}>{m}</option>))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider font-medium">Amount ($)</label>
                                <input type="number" min="0" step="0.01" value={formData.paymentAmount || ""} onChange={(e) => setFormData({ ...formData, paymentAmount: parseFloat(e.target.value) || 0 })} placeholder="0.00" className="w-full bg-surface border border-border-light rounded-lg px-4 py-2.5 text-sm text-foreground placeholder-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25 transition-all" />
                            </div>
                        </div>

                        {/* Save as default for promoter */}
                        {formData.promoterName.trim() && !editingPromo && (
                            <label className="flex items-center gap-2 cursor-pointer group animate-fade-in">
                                <input
                                    type="checkbox"
                                    checked={saveAsDefault}
                                    onChange={(e) => setSaveAsDefault(e.target.checked)}
                                    className="w-4 h-4 rounded border border-border-light bg-surface accent-accent cursor-pointer"
                                />
                                <span className="text-xs text-text-muted group-hover:text-text-secondary transition-colors">
                                    Save payment defaults for <span className="text-accent font-medium">{formData.promoterName.trim()}</span>
                                </span>
                            </label>
                        )}

                        {/* Bundle Option */}
                        <div className="flex items-center gap-3 px-4 py-3 bg-surface border border-border-light rounded-xl">
                            <button
                                type="button"
                                onClick={() => {
                                    const next = !formData.isBundle;
                                    setFormData({ ...formData, isBundle: next, bundleCount: next ? 3 : null });
                                }}
                                className="flex items-center gap-2 text-sm text-text-muted hover:text-text-secondary transition-colors"
                            >
                                <div className={`w-10 h-5 rounded-full relative transition-colors ${formData.isBundle ? "bg-accent" : "bg-surface-hover"}`}>
                                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${formData.isBundle ? "left-5" : "left-0.5"}`} />
                                </div>
                                Bundle deal
                            </button>
                            {formData.isBundle && (
                                <div className="flex items-center gap-2 ml-auto animate-fade-in">
                                    <div className="flex items-center gap-1">
                                        <span className="text-xs text-text-muted hidden sm:inline">Post #</span>
                                        <input
                                            type="number"
                                            min="1"
                                            max={formData.bundleCount || 100}
                                            value={formData.bundleIndex || ""}
                                            onChange={(e) => setFormData({ ...formData, bundleIndex: parseInt(e.target.value) || null })}
                                            placeholder="1"
                                            className="w-12 bg-surface border border-border-light rounded-lg px-2 py-1.5 text-sm text-foreground text-center focus:outline-none focus:border-accent/50 transition-all placeholder-text-muted"
                                        />
                                    </div>
                                    <span className="text-xs text-text-muted font-medium">of</span>
                                    <div className="flex items-center gap-1">
                                        <input
                                            type="number"
                                            min="2"
                                            max="100"
                                            value={formData.bundleCount || 3}
                                            onChange={(e) => setFormData({ ...formData, bundleCount: parseInt(e.target.value) || 3 })}
                                            className="w-14 bg-surface border border-border-light rounded-lg px-2 py-1.5 text-sm text-foreground text-center focus:outline-none focus:border-accent/50 transition-all"
                                        />
                                        <span className="text-xs text-text-muted hidden sm:inline">total</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Payment Status */}
                        <div>
                            <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider font-medium">Payment Status</label>
                            <div className="flex gap-2">
                                {PAYMENT_STATUSES.map((status) => {
                                    const isActive = formData.paymentStatus === status;
                                    const colorMap: Record<string, string> = {
                                        Pending: isActive ? "bg-amber-500/20 border-amber-500/40 text-amber-400" : "border-border-light text-text-muted hover:text-text-muted",
                                        Paid: isActive ? "bg-green-500/20 border-green-500/40 text-green-400" : "border-border-light text-text-muted hover:text-text-muted",
                                        Overdue: isActive ? "bg-red-500/20 border-red-500/40 text-red-400" : "border-border-light text-text-muted hover:text-text-muted",
                                    };
                                    return (
                                        <button key={status} type="button" onClick={() => setFormData({ ...formData, paymentStatus: status as "Pending" | "Paid" | "Overdue" })} className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${colorMap[status]}`}>
                                            {status}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Notes */}
                        <div>
                            <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider font-medium">Notes <span className="text-text-muted opacity-50">(optional)</span></label>
                            <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Any extra context..." rows={3} className="w-full bg-surface border border-border-light rounded-lg px-4 py-2.5 text-sm text-foreground placeholder-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25 transition-all resize-none" />
                        </div>

                        {/* ── Recurring Section ──────────────────────── */}
                        {!editingPromo && !isDuplicate && (
                            <div className="border border-border-light rounded-xl overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => toggleRecurring(!showRecurring)}
                                    className="w-full flex items-center justify-between px-4 py-3 text-sm text-text-muted hover:text-text-secondary transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.182" />
                                        </svg>
                                        Make this recurring
                                    </div>
                                    <div className={`w-10 h-5 rounded-full relative transition-colors ${showRecurring ? "bg-accent" : "bg-surface-hover"}`}>
                                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${showRecurring ? "left-5" : "left-0.5"}`} />
                                    </div>
                                </button>

                                {showRecurring && (
                                    <div className="px-4 pb-4 space-y-3 animate-fade-in border-t border-border-light">
                                        <div className="pt-3">
                                            <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider font-medium">Frequency</label>
                                            <select value={formData.recurringFrequency || "weekly"} onChange={(e) => setFormData({ ...formData, recurringFrequency: e.target.value as "weekly" | "biweekly" | "monthly" })} className="w-full bg-surface border border-border-light rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent/50 appearance-none cursor-pointer transition-all">
                                                {RECURRING_FREQUENCIES.map((f) => (<option key={f.value} value={f.value}>{f.label}</option>))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider font-medium">Ends</label>
                                            <select value={formData.recurringEndType || "never"} onChange={(e) => {
                                                const val = e.target.value as "never" | "after_count" | "until_date";
                                                setFormData({ ...formData, recurringEndType: val, recurringEndValue: val === "after_count" ? 4 : null });
                                            }} className="w-full bg-surface border border-border-light rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent/50 appearance-none cursor-pointer transition-all">
                                                <option value="never">Never (runs for 3 months)</option>
                                                <option value="after_count">After X occurrences</option>
                                                <option value="until_date">Until specific date</option>
                                            </select>
                                        </div>
                                        {formData.recurringEndType === "after_count" && (
                                            <div className="animate-fade-in">
                                                <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider font-medium">Number of occurrences</label>
                                                <input type="number" min="1" max="52" value={formData.recurringEndValue || 4} onChange={(e) => setFormData({ ...formData, recurringEndValue: parseInt(e.target.value) || 4 })} className="w-full bg-surface border border-border-light rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent/50 transition-all" />
                                            </div>
                                        )}
                                        {formData.recurringEndType === "until_date" && (
                                            <div className="animate-fade-in">
                                                <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider font-medium">End date</label>
                                                <input type="date" value={formData.recurringEndValue ? new Date(formData.recurringEndValue).toISOString().split("T")[0] : ""} onChange={(e) => setFormData({ ...formData, recurringEndValue: new Date(e.target.value).getTime() })} className="w-full bg-surface border border-border-light rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent/50 transition-all" />
                                            </div>
                                        )}
                                        <p className="text-xs text-text-muted mt-1">
                                            Future promos will be auto-generated with payment status set to Pending.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </form>

                    {/* Footer */}
                    <div className="px-5 sm:px-6 py-4 border-t border-border-light flex items-center gap-3 safe-area-bottom">
                        <button type="button" onClick={onClose} className="flex-1 py-3 sm:py-2.5 rounded-lg border border-border-light text-sm text-text-muted hover:text-text-secondary hover:bg-surface transition-all active:bg-white/[0.08]">Cancel</button>
                        <button onClick={handleSubmit} disabled={loading} className="flex-1 py-3 sm:py-2.5 rounded-lg bg-accent hover:bg-accent/90 text-foreground text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:bg-accent/80">
                            {loading && (<div className="w-4 h-4 border-2 border-border-light border-t-foreground rounded-full animate-spin" />)}
                            {isDuplicate ? "Duplicate" : editingPromo ? "Save Changes" : formData.isRecurring ? "Create Series" : "Add Promo"}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
