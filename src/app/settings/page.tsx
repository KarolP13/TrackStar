"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import { useTheme } from "@/lib/ThemeContext";
import { subscribeToPromos } from "@/lib/promos";
import { exportPromosToCSV } from "@/lib/csvExport";
import { exportPromoTablePDF } from "@/lib/pdfExport";
import { Promo, PAYMENT_METHODS, PromoterPreset } from "@/lib/types";

const PRESET_COLORS = [
    "#3b82f6", // Blue
    "#8b5cf6", // Purple
    "#ec4899", // Pink
    "#ef4444", // Red
    "#f59e0b", // Amber
    "#10b981", // Emerald
    "#06b6d4", // Cyan
    "#f43f5e", // Rose
];

export default function SettingsPage() {
    const { user, logout } = useAuth();
    const { profile, updateProfile } = useTheme();
    const [promos, setPromos] = useState<Promo[]>([]);

    // Form state
    const [displayName, setDisplayName] = useState("");
    const [themeMode, setThemeMode] = useState<"dark" | "light">("dark");
    const [accentColor, setAccentColor] = useState("#3b82f6");
    const [paymentMethod, setPaymentMethod] = useState("");
    const [accountHandle, setAccountHandle] = useState("");
    const [promoterName, setPromoterName] = useState("");

    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState("");

    // Promoter presets state
    const [presetEdits, setPresetEdits] = useState<Record<string, PromoterPreset>>({});
    const [presetSaving, setPresetSaving] = useState(false);
    const [presetMessage, setPresetMessage] = useState("");

    // Populate form when profile loads
    useEffect(() => {
        setDisplayName(profile.displayName || "");
        setThemeMode(profile.themeMode || "dark");
        setAccentColor(profile.accentColor || "#3b82f6");
        setPaymentMethod(profile.defaults?.paymentMethod || "");
        setAccountHandle(profile.defaults?.accountHandle || "");
        setPromoterName(profile.defaults?.promoterName || "");
    }, [profile]);

    // Derive unique promoter names from past promos
    const uniquePromoterNames = Array.from(new Set(promos.map(p => p.promoterName).filter(Boolean))).sort();

    // Initialize preset edits from profile when it loads
    useEffect(() => {
        const existing = profile.promoterPresets || {};
        const initial: Record<string, PromoterPreset> = {};
        uniquePromoterNames.forEach(name => {
            initial[name] = existing[name] || { paymentMethod: "", amount: null };
        });
        setPresetEdits(initial);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profile.promoterPresets, promos]);

    // Fetch promos for export features
    useEffect(() => {
        if (!user) return;
        const unsub = subscribeToPromos(user.uid, (data) => setPromos(data));
        return unsub;
    }, [user]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setSaveMessage("");

        try {
            await updateProfile({
                displayName,
                themeMode,
                accentColor,
                defaults: {
                    paymentMethod,
                    accountHandle,
                    promoterName,
                },
            });
            setSaveMessage("Settings saved successfully!");
            setTimeout(() => setSaveMessage(""), 3000);
        } catch (error) {
            setSaveMessage("Failed to save settings.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleSavePresets = async () => {
        setPresetSaving(true);
        setPresetMessage("");
        try {
            // Filter out empty presets
            const cleanPresets: Record<string, PromoterPreset> = {};
            Object.entries(presetEdits).forEach(([name, preset]) => {
                if (preset.paymentMethod) {
                    cleanPresets[name] = preset;
                }
            });
            await updateProfile({ promoterPresets: cleanPresets });
            setPresetMessage("Presets saved!");
            setTimeout(() => setPresetMessage(""), 3000);
        } catch {
            setPresetMessage("Failed to save presets.");
        } finally {
            setPresetSaving(false);
        }
    };

    return (
        <ProtectedRoute>
            <DashboardLayout>
                <div className="animate-fade-in max-w-3xl pb-12">
                    <h1 className="text-2xl font-bold text-foreground mb-1">Settings</h1>
                    <p className="text-sm text-text-muted mb-8">
                        Manage your preferences, appearance, and data
                    </p>

                    <form onSubmit={handleSave} className="space-y-6">
                        {/* Appearance section */}
                        <div className="bg-surface border border-border-light rounded-xl p-6">
                            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-6">
                                Appearance
                            </h2>
                            <div className="space-y-6">
                                {/* Theme Mode */}
                                <div>
                                    <label className="block text-xs text-text-muted mb-3 uppercase tracking-wider font-medium">
                                        Theme Mode
                                    </label>
                                    <div className="flex gap-4">
                                        <label className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border cursor-pointer transition-all ${themeMode === "dark" ? "border-accent bg-accent/10" : "border-border-light hover:bg-surface-hover"}`}>
                                            <input type="radio" name="theme" value="dark" checked={themeMode === "dark"} onChange={() => setThemeMode("dark")} className="sr-only" />
                                            <div className="w-4 h-4 rounded-full border border-current flex items-center justify-center">
                                                {themeMode === "dark" && <div className="w-2h h-2 rounded-full bg-accent" />}
                                            </div>
                                            <span className={`text-sm font-medium ${themeMode === "dark" ? "text-accent" : "text-text-muted"}`}>Dark</span>
                                        </label>
                                        <label className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border cursor-pointer transition-all ${themeMode === "light" ? "border-accent bg-accent/10" : "border-border-light hover:bg-surface-hover"}`}>
                                            <input type="radio" name="theme" value="light" checked={themeMode === "light"} onChange={() => setThemeMode("light")} className="sr-only" />
                                            <div className="w-4 h-4 rounded-full border border-current flex items-center justify-center">
                                                {themeMode === "light" && <div className="w-2h h-2 rounded-full bg-accent" />}
                                            </div>
                                            <span className={`text-sm font-medium ${themeMode === "light" ? "text-accent" : "text-text-muted"}`}>Light</span>
                                        </label>
                                    </div>
                                </div>

                                {/* Accent Color */}
                                <div>
                                    <label className="block text-xs text-text-muted mb-3 uppercase tracking-wider font-medium">
                                        Accent Color
                                    </label>
                                    <div className="flex flex-wrap gap-3">
                                        {PRESET_COLORS.map((color) => (
                                            <button
                                                key={color}
                                                type="button"
                                                onClick={() => setAccentColor(color)}
                                                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${accentColor === color ? "ring-2 ring-offset-2 ring-offset-background ring-accent scale-110" : "hover:scale-105"}`}
                                                style={{ backgroundColor: color }}
                                                aria-label={`Select accent color ${color}`}
                                            >
                                                {accentColor === color && (
                                                    <svg className="w-5 h-5 text-white drop-shadow-md" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                    </svg>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Account Section */}
                        <div className="bg-surface border border-border-light rounded-xl p-6">
                            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-6">
                                Account Details
                            </h2>
                            <div className="space-y-5">
                                <div>
                                    <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider font-medium">
                                        Display Name
                                    </label>
                                    <input
                                        type="text"
                                        value={displayName}
                                        onChange={(e) => setDisplayName(e.target.value)}
                                        placeholder="Your Name"
                                        className="w-full max-w-sm bg-surface-hover border border-border-light rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25 transition-all"
                                    />
                                </div>
                                <div className="flex gap-8">
                                    <div>
                                        <label className="block text-xs text-text-muted mb-1 uppercase tracking-wider">
                                            Email Address
                                        </label>
                                        <p className="text-foreground text-sm">{user?.email}</p>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-text-muted mb-1 uppercase tracking-wider">
                                            User ID
                                        </label>
                                        <p className="text-text-muted text-xs font-mono">{user?.uid}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Promo Defaults Section */}
                        <div className="bg-surface border border-border-light rounded-xl p-6">
                            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-2">
                                Promo Defaults
                            </h2>
                            <p className="text-xs text-text-muted mb-6">
                                Pre-fill fields when adding a new promo to save time.
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider font-medium">
                                        Default Payment Method
                                    </label>
                                    <select
                                        value={paymentMethod}
                                        onChange={(e) => setPaymentMethod(e.target.value)}
                                        className="w-full bg-surface-hover border border-border-light rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent/50 appearance-none cursor-pointer transition-all"
                                    >
                                        <option value="">None</option>
                                        {PAYMENT_METHODS.map((m) => (
                                            <option key={m} value={m}>{m}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider font-medium">
                                        Default Account Handle
                                    </label>
                                    <input
                                        type="text"
                                        value={accountHandle}
                                        onChange={(e) => setAccountHandle(e.target.value)}
                                        placeholder="e.g. @songsgohard"
                                        className="w-full bg-surface-hover border border-border-light rounded-lg px-4 py-2.5 text-sm text-foreground font-mono focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25 transition-all"
                                    />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider font-medium">
                                        Default Promoter Name
                                    </label>
                                    <input
                                        type="text"
                                        value={promoterName}
                                        onChange={(e) => setPromoterName(e.target.value)}
                                        placeholder="e.g. John Doe"
                                        className="w-full max-w-sm bg-surface-hover border border-border-light rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25 transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Save Button */}
                        <div className="flex items-center gap-4">
                            <button
                                type="submit"
                                disabled={isSaving}
                                className="px-6 py-2.5 rounded-lg bg-accent hover:bg-accent/90 text-white text-sm font-medium transition-all shadow-lg shadow-accent/20 flex items-center gap-2 disabled:opacity-50"
                            >
                                {isSaving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                Save Preferences
                            </button>
                            {saveMessage && (
                                <p className={`text-sm ${saveMessage.includes("Failed") ? "text-red-400" : "text-emerald-500"} animate-fade-in`}>
                                    {saveMessage}
                                </p>
                            )}
                        </div>
                    </form>

                    <hr className="my-6 border-border-light" />

                    {/* Promoter Presets Section */}
                    <div className="bg-surface border border-border-light rounded-xl p-6">
                        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-2">
                            Promoter Presets
                        </h2>
                        <p className="text-xs text-text-muted mb-6">
                            Set default payment method and amount per promoter. These auto-fill when selecting a promoter in the Add Promo modal.
                        </p>

                        {uniquePromoterNames.length === 0 ? (
                            <p className="text-sm text-text-muted italic">No promoters found yet. Add a promo to see promoters here.</p>
                        ) : (
                            <div className="space-y-3">
                                {/* Header row */}
                                <div className="hidden sm:grid grid-cols-[1fr_150px_120px] gap-3 px-1">
                                    <span className="text-xs text-text-muted uppercase tracking-wider font-medium">Promoter</span>
                                    <span className="text-xs text-text-muted uppercase tracking-wider font-medium">Default Method</span>
                                    <span className="text-xs text-text-muted uppercase tracking-wider font-medium">Default Amount</span>
                                </div>
                                {uniquePromoterNames.map(name => {
                                    const preset = presetEdits[name] || { paymentMethod: "", amount: null };
                                    return (
                                        <div key={name} className="grid grid-cols-1 sm:grid-cols-[1fr_150px_120px] gap-2 sm:gap-3 p-3 sm:p-2 sm:px-1 bg-surface-hover/50 sm:bg-transparent rounded-lg sm:rounded-none border border-border-light sm:border-0 sm:border-b">
                                            <div className="flex items-center">
                                                <span className="text-sm text-foreground font-medium">{name}</span>
                                            </div>
                                            <select
                                                value={preset.paymentMethod}
                                                onChange={(e) => setPresetEdits(prev => ({ ...prev, [name]: { ...preset, paymentMethod: e.target.value } }))}
                                                className="bg-surface border border-border-light rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent/50 appearance-none cursor-pointer transition-all"
                                            >
                                                <option value="">No default</option>
                                                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                                            </select>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={preset.amount ?? ""}
                                                onChange={(e) => setPresetEdits(prev => ({ ...prev, [name]: { ...preset, amount: parseFloat(e.target.value) || null } }))}
                                                placeholder="—"
                                                className="bg-surface border border-border-light rounded-lg px-3 py-2 text-sm text-foreground placeholder-text-muted focus:outline-none focus:border-accent/50 transition-all"
                                            />
                                        </div>
                                    );
                                })}
                                <div className="flex items-center gap-4 pt-2">
                                    <button
                                        type="button"
                                        onClick={handleSavePresets}
                                        disabled={presetSaving}
                                        className="px-5 py-2 rounded-lg bg-accent hover:bg-accent/90 text-white text-sm font-medium transition-all shadow-lg shadow-accent/20 flex items-center gap-2 disabled:opacity-50"
                                    >
                                        {presetSaving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                        Save Presets
                                    </button>
                                    {presetMessage && (
                                        <p className={`text-sm ${presetMessage.includes("Failed") ? "text-red-400" : "text-emerald-500"} animate-fade-in`}>
                                            {presetMessage}
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <hr className="my-10 border-border-light" />

                    {/* Data Management Section */}
                    <div className="bg-surface border border-border-light rounded-xl p-6 mb-6">
                        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-2">
                            Data Management
                        </h2>
                        <p className="text-xs text-text-muted mb-6">
                            Export your promotion data for external use.
                        </p>
                        <div className="flex flex-wrap gap-3">
                            <button
                                onClick={() => exportPromosToCSV(promos)}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border-light text-text-muted hover:text-foreground hover:bg-surface-hover text-sm font-medium transition-all"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125-1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 1.5v-1.5m0 0c0-.621.504-1.125 1.125-1.125m0 0h7.5" />
                                </svg>
                                Export CSV
                            </button>
                            <button
                                onClick={() => exportPromoTablePDF(promos)}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border-light text-text-muted hover:text-foreground hover:bg-surface-hover text-sm font-medium transition-all"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                </svg>
                                Export PDF
                            </button>
                        </div>
                    </div>

                    {/* Danger Zone */}
                    <div className="bg-surface border border-red-500/20 rounded-xl p-6">
                        <h2 className="text-sm font-semibold text-red-400 uppercase tracking-wider mb-2">
                            Session
                        </h2>
                        <p className="text-xs text-text-muted mb-4 border-none">
                            Sign out of your TrackStar account on this device.
                        </p>
                        <button
                            onClick={logout}
                            type="button"
                            className="px-5 py-2.5 rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 text-sm font-medium hover:bg-red-500/20 hover:border-red-500/30 transition-all"
                        >
                            Sign Out
                        </button>
                    </div>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
