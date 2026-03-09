"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/lib/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import { Promo } from "@/lib/types";
import { subscribeToPromos } from "@/lib/promos";
import { exportAnalyticsPDF } from "@/lib/pdfExport";
import { exportPromosToCSV } from "@/lib/csvExport";
import {
    LineChart, Line, BarChart, Bar, AreaChart, Area,
    PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Legend,
} from "recharts";

type DateRange = "7d" | "30d" | "90d" | "all";
type TimeView = "weekly" | "monthly";

const CHART_COLORS = [
    "#3b82f6", "#60a5fa", "#93c5fd", "#2563eb",
    "#1d4ed8", "#818cf8", "#a78bfa", "#6366f1",
];

const STATUS_COLORS: Record<string, string> = {
    Paid: "#22c55e",
    Pending: "#f59e0b",
    Overdue: "#ef4444",
};

function getDateRangeStart(range: DateRange): Date | null {
    if (range === "all") return null;
    const now = new Date();
    const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
    now.setDate(now.getDate() - days);
    now.setHours(0, 0, 0, 0);
    return now;
}

function getWeekKey(date: Date): string {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getMonthKey(date: Date): string {
    return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

// Custom dark tooltip
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
    if (!active || !payload) return null;
    return (
        <div className="bg-surface border border-border-light rounded-lg px-3 py-2 shadow-xl">
            <p className="text-xs text-text-muted mb-1">{label}</p>
            {payload.map((entry, i) => (
                <p key={i} className="text-sm font-medium" style={{ color: entry.color }}>
                    {entry.name}: {typeof entry.value === "number" ? `$${entry.value.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : entry.value}
                </p>
            ))}
        </div>
    );
}

function CustomPieTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number }> }) {
    if (!active || !payload?.[0]) return null;
    return (
        <div className="bg-surface border border-border-light rounded-lg px-3 py-2 shadow-xl">
            <p className="text-sm font-medium text-foreground">{payload[0].name}: {payload[0].value}</p>
        </div>
    );
}

export default function AnalyticsPage() {
    const { user } = useAuth();
    const [promos, setPromos] = useState<Promo[]>([]);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState<DateRange>("30d");
    const [timeView, setTimeView] = useState<TimeView>("weekly");

    useEffect(() => {
        if (!user) return;
        const unsub = subscribeToPromos(user.uid, (data) => {
            setPromos(data);
            setLoading(false);
        });
        return unsub;
    }, [user]);

    // Filter promos by date range
    const filteredPromos = useMemo(() => {
        const start = getDateRangeStart(dateRange);
        if (!start) return promos;
        return promos.filter((p) => p.promoDate?.toDate() >= start);
    }, [promos, dateRange]);

    // ── Summary Stats ──────────────────────────
    const summaryStats = useMemo(() => {
        const totalPromosCount = filteredPromos.reduce((sum, p) => sum + (p.isBundle && p.bundleCount ? p.bundleCount : 1), 0);
        const totalRevenue = filteredPromos.reduce((sum, p) => sum + p.paymentAmount, 0);
        const avgValue = totalPromosCount > 0 ? totalRevenue / totalPromosCount : 0;

        const accountCounts: Record<string, number> = {};
        const artistCounts: Record<string, number> = {};
        filteredPromos.forEach((p) => {
            accountCounts[p.accountHandle] = (accountCounts[p.accountHandle] || 0) + 1;
            const artist = p.promoting || (p as unknown as Record<string, string>).artistName || "Unknown";
            artistCounts[artist] = (artistCounts[artist] || 0) + 1;
        });

        const mostActiveAccount = Object.entries(accountCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
        const mostPromotedArtist = Object.entries(artistCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";

        return { totalRevenue, avgValue, mostActiveAccount, mostPromotedArtist };
    }, [filteredPromos]);

    // ── Chart 1: Revenue Over Time ──────────────
    const revenueOverTime = useMemo(() => {
        const buckets: Record<string, number> = {};
        filteredPromos.forEach((p) => {
            const date = p.promoDate?.toDate();
            if (!date) return;
            const key = timeView === "weekly" ? getWeekKey(date) : getMonthKey(date);
            buckets[key] = (buckets[key] || 0) + p.paymentAmount;
        });
        return Object.entries(buckets)
            .map(([name, revenue]) => ({ name, revenue }))
            .reverse();
    }, [filteredPromos, timeView]);

    // ── Chart 2: Revenue By Account ──────────────
    const revenueByAccount = useMemo(() => {
        const buckets: Record<string, number> = {};
        filteredPromos.forEach((p) => {
            buckets[p.accountHandle] = (buckets[p.accountHandle] || 0) + p.paymentAmount;
        });
        return Object.entries(buckets)
            .map(([name, revenue]) => ({ name, revenue }))
            .sort((a, b) => b.revenue - a.revenue);
    }, [filteredPromos]);

    // ── Chart 3: Top Artists ─────────────────────
    const topArtists = useMemo(() => {
        const buckets: Record<string, number> = {};
        filteredPromos.forEach((p) => {
            const artist = p.promoting || (p as unknown as Record<string, string>).artistName || "Unknown";
            buckets[artist] = (buckets[artist] || 0) + p.paymentAmount;
        });
        return Object.entries(buckets)
            .map(([name, spend]) => ({ name, spend }))
            .sort((a, b) => b.spend - a.spend)
            .slice(0, 10);
    }, [filteredPromos]);

    // ── Chart 4: Payment Status ──────────────────
    const paymentStatus = useMemo(() => {
        const counts: Record<string, number> = { Paid: 0, Pending: 0, Overdue: 0 };
        filteredPromos.forEach((p) => {
            counts[p.paymentStatus] = (counts[p.paymentStatus] || 0) + 1;
        });
        return Object.entries(counts)
            .filter(([, v]) => v > 0)
            .map(([name, value]) => ({ name, value }));
    }, [filteredPromos]);

    // ── Chart 5: Promo Volume Over Time ──────────
    const promoVolume = useMemo(() => {
        const buckets: Record<string, number> = {};
        filteredPromos.forEach((p) => {
            const date = p.promoDate?.toDate();
            if (!date) return;
            const key = timeView === "weekly" ? getWeekKey(date) : getMonthKey(date);
            buckets[key] = (buckets[key] || 0) + (p.isBundle && p.bundleCount ? p.bundleCount : 1);
        });
        return Object.entries(buckets)
            .map(([name, count]) => ({ name, count }))
            .reverse();
    }, [filteredPromos, timeView]);

    const dateRangeOptions: { value: DateRange; label: string }[] = [
        { value: "7d", label: "7 Days" },
        { value: "30d", label: "30 Days" },
        { value: "90d", label: "90 Days" },
        { value: "all", label: "All Time" },
    ];

    return (
        <ProtectedRoute>
            <DashboardLayout>
                <div className="animate-fade-in space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Analytics</h1>
                            <p className="text-xs sm:text-sm text-text-muted mt-0.5">
                                Insights from your promo data
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {dateRangeOptions.map((opt) => (
                                <button
                                    key={opt.value}
                                    onClick={() => setDateRange(opt.value)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${dateRange === opt.value ? "bg-accent-light text-accent border border-accent/30" : "bg-surface text-text-muted border border-border-light hover:text-text-secondary"}`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mb-4" />
                            <p className="text-text-muted text-sm">Loading analytics...</p>
                        </div>
                    ) : filteredPromos.length === 0 ? (
                        <div className="text-center py-20">
                            <p className="text-text-muted text-sm">No promos in this date range.</p>
                        </div>
                    ) : (
                        <>
                            {/* Summary Stats */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                                <div className="bg-surface border border-border-light rounded-xl p-3.5 sm:p-5">
                                    <span className="text-[10px] sm:text-xs text-text-muted uppercase tracking-wider font-medium">Period Revenue</span>
                                    <p className="text-lg sm:text-2xl font-bold text-accent mt-1">${summaryStats.totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
                                </div>
                                <div className="bg-surface border border-border-light rounded-xl p-3.5 sm:p-5">
                                    <span className="text-[10px] sm:text-xs text-text-muted uppercase tracking-wider font-medium">Avg Promo Value</span>
                                    <p className="text-lg sm:text-2xl font-bold text-emerald-500 mt-1">${summaryStats.avgValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
                                </div>
                                <div className="bg-surface border border-border-light rounded-xl p-3.5 sm:p-5">
                                    <span className="text-[10px] sm:text-xs text-text-muted uppercase tracking-wider font-medium">Most Active</span>
                                    <p className="text-base sm:text-lg font-bold text-purple-500 mt-1 truncate font-mono">{summaryStats.mostActiveAccount}</p>
                                </div>
                                <div className="bg-surface border border-border-light rounded-xl p-3.5 sm:p-5">
                                    <span className="text-[10px] sm:text-xs text-text-muted uppercase tracking-wider font-medium">Top Artist</span>
                                    <p className="text-base sm:text-lg font-bold text-amber-500 mt-1 truncate">{summaryStats.mostPromotedArtist}</p>
                                </div>
                            </div>

                            {/* Revenue Over Time */}
                            <div className="bg-surface border border-border-light rounded-xl p-4 sm:p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-semibold text-foreground">Revenue Over Time</h3>
                                    <div className="flex gap-1">
                                        <button onClick={() => setTimeView("weekly")} className={`px-2.5 py-1 rounded text-[10px] font-medium transition-all ${timeView === "weekly" ? "bg-accent-light text-accent" : "text-text-muted hover:text-text-secondary"}`}>Weekly</button>
                                        <button onClick={() => setTimeView("monthly")} className={`px-2.5 py-1 rounded text-[10px] font-medium transition-all ${timeView === "monthly" ? "bg-accent-light text-accent" : "text-text-muted hover:text-text-secondary"}`}>Monthly</button>
                                    </div>
                                </div>
                                <ResponsiveContainer width="100%" height={280}>
                                    <LineChart data={revenueOverTime}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Line type="monotone" dataKey="revenue" stroke="var(--accent)" strokeWidth={2.5} dot={{ r: 4, fill: "var(--accent)" }} activeDot={{ r: 6, fill: "var(--accent)" }} name="Revenue" />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Two Column: Revenue by Account + Payment Status */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {/* Revenue By Account */}
                                <div className="bg-surface border border-border-light rounded-xl p-4 sm:p-6">
                                    <h3 className="text-sm font-semibold text-foreground mb-4">Revenue by Account</h3>
                                    <ResponsiveContainer width="100%" height={260}>
                                        <BarChart data={revenueByAccount} layout="vertical">
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                                            <XAxis type="number" tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                                            <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} width={100} />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Bar dataKey="revenue" name="Revenue" radius={[0, 4, 4, 0]}>
                                                {revenueByAccount.map((_, i) => (
                                                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>

                                {/* Payment Status */}
                                <div className="bg-surface border border-border-light rounded-xl p-4 sm:p-6">
                                    <h3 className="text-sm font-semibold text-foreground mb-4">Payment Status</h3>
                                    <ResponsiveContainer width="100%" height={260}>
                                        <PieChart>
                                            <Pie data={paymentStatus} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={4} dataKey="value" nameKey="name" strokeWidth={0}>
                                                {paymentStatus.map((entry) => (
                                                    <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || "#666"} />
                                                ))}
                                            </Pie>
                                            <Tooltip content={<CustomPieTooltip />} />
                                            <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: "var(--text-secondary)" }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Two Column: Top Artists + Promo Volume */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {/* Top Artists */}
                                <div className="bg-surface border border-border-light rounded-xl p-4 sm:p-6">
                                    <h3 className="text-sm font-semibold text-foreground mb-4">Top Artists by Spend</h3>
                                    <ResponsiveContainer width="100%" height={280}>
                                        <BarChart data={topArtists} layout="vertical">
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                                            <XAxis type="number" tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                                            <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} width={100} />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Bar dataKey="spend" name="Total Spend" radius={[0, 4, 4, 0]} fill="#818cf8" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>

                                {/* Promo Volume */}
                                <div className="bg-surface border border-border-light rounded-xl p-4 sm:p-6">
                                    <h3 className="text-sm font-semibold text-foreground mb-4">Promo Volume</h3>
                                    <ResponsiveContainer width="100%" height={280}>
                                        <AreaChart data={promoVolume}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                                            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                                            <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                                            <Tooltip content={<CustomPieTooltip />} />
                                            <Area type="monotone" dataKey="count" stroke="var(--accent)" fill="var(--accent-light)" strokeWidth={2} name="Promos" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
