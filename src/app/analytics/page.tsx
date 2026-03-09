"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/lib/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import { Promo } from "@/lib/types";
import { subscribeToPromos } from "@/lib/promos";
import {
    LineChart, Line, BarChart, Bar, AreaChart, Area,
    PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Legend,
} from "recharts";

type DateRange = "7d" | "30d" | "90d" | "all";
type TimeView = "daily" | "weekly" | "monthly";
type LeaderboardSort = "revenue" | "count" | "avg" | "pct";

const CHART_COLORS = [
    "#3b82f6", "#60a5fa", "#93c5fd", "#2563eb",
    "#1d4ed8", "#818cf8", "#a78bfa", "#6366f1",
];

const ENGAGEMENT_COLORS: Record<string, string> = {
    impressions: "#3b82f6",
    likes: "#ef4444",
    comments: "#22c55e",
    bookmarks: "#f59e0b",
    retweets: "#8b5cf6",
};

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

function getDayKey(date: Date): string {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtNum(n: number): string {
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(n % 1_000_000_000 === 0 ? 0 : 1)}B`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}K`;
    return String(n);
}

// Custom tooltips
function MoneyTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
    if (!active || !payload) return null;
    return (
        <div className="bg-surface border border-border-light rounded-lg px-3 py-2 shadow-xl">
            <p className="text-xs text-text-muted mb-1">{label}</p>
            {payload.map((entry, i) => (
                <p key={i} className="text-sm font-medium" style={{ color: entry.color }}>
                    {entry.name}: ${entry.value.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
            ))}
        </div>
    );
}

function NumTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
    if (!active || !payload) return null;
    return (
        <div className="bg-surface border border-border-light rounded-lg px-3 py-2 shadow-xl">
            <p className="text-xs text-text-muted mb-1">{label}</p>
            {payload.map((entry, i) => (
                <p key={i} className="text-sm font-medium" style={{ color: entry.color }}>
                    {entry.name}: {fmtNum(entry.value)}
                </p>
            ))}
        </div>
    );
}

function SimplePieTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number }> }) {
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
    const [leaderboardSort, setLeaderboardSort] = useState<LeaderboardSort>("revenue");
    const [leaderboardDir, setLeaderboardDir] = useState<"asc" | "desc">("desc");
    // Filters
    const [filterPromoter, setFilterPromoter] = useState("All");
    const [filterAccount, setFilterAccount] = useState("All");

    useEffect(() => {
        if (!user) return;
        const unsub = subscribeToPromos(user.uid, (data) => {
            setPromos(data);
            setLoading(false);
        });
        return unsub;
    }, [user]);

    // Unique values for filters
    const uniquePromoters = useMemo(() => [...new Set(promos.map((p) => p.promoterName).filter(Boolean))].sort(), [promos]);
    const uniqueAccounts = useMemo(() => [...new Set(promos.map((p) => p.accountHandle).filter(Boolean))].sort(), [promos]);

    // Filter promos by date range + dropdown filters
    const filteredPromos = useMemo(() => {
        const start = getDateRangeStart(dateRange);
        return promos.filter((p) => {
            if (start && p.promoDate?.toDate() < start) return false;
            if (filterPromoter !== "All" && p.promoterName !== filterPromoter) return false;
            if (filterAccount !== "All" && p.accountHandle !== filterAccount) return false;
            return true;
        });
    }, [promos, dateRange, filterPromoter, filterAccount]);

    const hasAnyEngagement = useMemo(() =>
        filteredPromos.some((p) => p.impressions || p.likes || p.comments || p.bookmarks || p.retweets),
        [filteredPromos]
    );

    const hasActiveFilters = filterPromoter !== "All" || filterAccount !== "All";

    // ── Summary Stats ──────────────────────────
    const summaryStats = useMemo(() => {
        const totalPromosCount = filteredPromos.reduce((sum, p) => sum + (p.isBundle && p.bundleCount ? p.bundleCount : 1), 0);
        const totalRevenue = filteredPromos.reduce((sum, p) => sum + p.paymentAmount, 0);
        const avgValue = totalPromosCount > 0 ? totalRevenue / totalPromosCount : 0;

        const accountCounts: Record<string, number> = {};
        const artistCounts: Record<string, number> = {};
        const promoterRevenue: Record<string, number> = {};
        filteredPromos.forEach((p) => {
            accountCounts[p.accountHandle] = (accountCounts[p.accountHandle] || 0) + 1;
            const artist = p.promoting || "Unknown";
            artistCounts[artist] = (artistCounts[artist] || 0) + 1;
            promoterRevenue[p.promoterName] = (promoterRevenue[p.promoterName] || 0) + p.paymentAmount;
        });

        const mostActiveAccount = Object.entries(accountCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
        const mostPromotedArtist = Object.entries(artistCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
        const topPromoterEntry = Object.entries(promoterRevenue).sort((a, b) => b[1] - a[1])[0];
        const topPromoterName = topPromoterEntry?.[0] || "—";
        const topPromoterAmount = topPromoterEntry?.[1] || 0;

        return { totalRevenue, avgValue, mostActiveAccount, mostPromotedArtist, topPromoterName, topPromoterAmount };
    }, [filteredPromos]);

    // ── Engagement Summary ───────────────────────
    const engagementStats = useMemo(() => {
        let totalImpressions = 0, totalLikes = 0, totalComments = 0, totalBookmarks = 0, totalRetweets = 0, postsWithData = 0;
        filteredPromos.forEach((p) => {
            const has = p.impressions || p.likes || p.comments || p.bookmarks || p.retweets;
            if (has) postsWithData++;
            totalImpressions += p.impressions || 0;
            totalLikes += p.likes || 0;
            totalComments += p.comments || 0;
            totalBookmarks += p.bookmarks || 0;
            totalRetweets += p.retweets || 0;
        });
        const totalEngagement = totalLikes + totalComments + totalBookmarks + totalRetweets;
        const engagementRate = totalImpressions > 0 ? (totalEngagement / totalImpressions) * 100 : 0;
        return { totalImpressions, totalLikes, totalComments, totalBookmarks, totalRetweets, postsWithData, engagementRate };
    }, [filteredPromos]);

    // ── Chart: Revenue Over Time ──────────────
    const revenueOverTime = useMemo(() => {
        const buckets: Record<string, number> = {};
        filteredPromos.forEach((p) => {
            const date = p.promoDate?.toDate();
            if (!date) return;
            const key = timeView === "daily" ? getDayKey(date) : timeView === "weekly" ? getWeekKey(date) : getMonthKey(date);
            buckets[key] = (buckets[key] || 0) + p.paymentAmount;
        });
        return Object.entries(buckets).map(([name, revenue]) => ({ name, revenue })).reverse();
    }, [filteredPromos, timeView]);

    // ── Chart: Revenue By Account ──────────────
    const revenueByAccount = useMemo(() => {
        const buckets: Record<string, number> = {};
        filteredPromos.forEach((p) => { buckets[p.accountHandle] = (buckets[p.accountHandle] || 0) + p.paymentAmount; });
        return Object.entries(buckets).map(([name, revenue]) => ({ name, revenue })).sort((a, b) => b.revenue - a.revenue);
    }, [filteredPromos]);

    // ── Chart: Top Artists ─────────────────────
    const topArtists = useMemo(() => {
        const buckets: Record<string, number> = {};
        filteredPromos.forEach((p) => { buckets[p.promoting || "Unknown"] = (buckets[p.promoting || "Unknown"] || 0) + p.paymentAmount; });
        return Object.entries(buckets).map(([name, spend]) => ({ name, spend })).sort((a, b) => b.spend - a.spend).slice(0, 10);
    }, [filteredPromos]);

    // ── Chart: Payment Status ──────────────────
    const paymentStatus = useMemo(() => {
        const counts: Record<string, number> = { Paid: 0, Pending: 0, Overdue: 0 };
        filteredPromos.forEach((p) => { counts[p.paymentStatus] = (counts[p.paymentStatus] || 0) + 1; });
        return Object.entries(counts).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));
    }, [filteredPromos]);

    // ── Chart: Promo Volume Over Time ──────────
    const promoVolume = useMemo(() => {
        const buckets: Record<string, number> = {};
        filteredPromos.forEach((p) => {
            const date = p.promoDate?.toDate();
            if (!date) return;
            const key = timeView === "daily" ? getDayKey(date) : timeView === "weekly" ? getWeekKey(date) : getMonthKey(date);
            buckets[key] = (buckets[key] || 0) + (p.isBundle && p.bundleCount ? p.bundleCount : 1);
        });
        return Object.entries(buckets).map(([name, count]) => ({ name, count })).reverse();
    }, [filteredPromos, timeView]);

    // ── Chart: Revenue by Promoter ─────────────
    const revenueByPromoter = useMemo(() => {
        const buckets: Record<string, number> = {};
        filteredPromos.forEach((p) => { buckets[p.promoterName] = (buckets[p.promoterName] || 0) + p.paymentAmount; });
        return Object.entries(buckets).map(([name, revenue]) => ({ name, revenue })).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
    }, [filteredPromos]);

    // ── Chart: Engagement Over Time ────────────
    const engagementOverTime = useMemo(() => {
        const buckets: Record<string, { impressions: number; likes: number; comments: number; bookmarks: number; retweets: number }> = {};
        filteredPromos.forEach((p) => {
            if (!p.impressions && !p.likes && !p.comments && !p.bookmarks && !p.retweets) return;
            const date = p.promoDate?.toDate();
            if (!date) return;
            const key = timeView === "daily" ? getDayKey(date) : timeView === "weekly" ? getWeekKey(date) : getMonthKey(date);
            if (!buckets[key]) buckets[key] = { impressions: 0, likes: 0, comments: 0, bookmarks: 0, retweets: 0 };
            buckets[key].impressions += p.impressions || 0;
            buckets[key].likes += p.likes || 0;
            buckets[key].comments += p.comments || 0;
            buckets[key].bookmarks += p.bookmarks || 0;
            buckets[key].retweets += p.retweets || 0;
        });
        return Object.entries(buckets).map(([name, data]) => ({ name, ...data })).reverse();
    }, [filteredPromos, timeView]);

    // ── Chart: Engagement by Promoter ──────────
    const engagementByPromoter = useMemo(() => {
        const buckets: Record<string, { impressions: number; likes: number; retweets: number }> = {};
        filteredPromos.forEach((p) => {
            if (!p.impressions && !p.likes && !p.retweets) return;
            if (!buckets[p.promoterName]) buckets[p.promoterName] = { impressions: 0, likes: 0, retweets: 0 };
            buckets[p.promoterName].impressions += p.impressions || 0;
            buckets[p.promoterName].likes += p.likes || 0;
            buckets[p.promoterName].retweets += p.retweets || 0;
        });
        return Object.entries(buckets)
            .map(([name, d]) => ({ name, ...d }))
            .sort((a, b) => b.impressions - a.impressions)
            .slice(0, 8);
    }, [filteredPromos]);

    // ── Promoter Leaderboard ────────────────
    const promoterLeaderboard = useMemo(() => {
        const totalRevenue = filteredPromos.reduce((sum, p) => sum + p.paymentAmount, 0);
        const dataMap: Record<string, { count: number; revenue: number; methods: Record<string, number>; impressions: number; likes: number }> = {};
        filteredPromos.forEach((p) => {
            if (!dataMap[p.promoterName]) dataMap[p.promoterName] = { count: 0, revenue: 0, methods: {}, impressions: 0, likes: 0 };
            const d = dataMap[p.promoterName];
            d.count += p.isBundle && p.bundleCount ? p.bundleCount : 1;
            d.revenue += p.paymentAmount;
            d.methods[p.paymentMethod] = (d.methods[p.paymentMethod] || 0) + 1;
            d.impressions += p.impressions || 0;
            d.likes += p.likes || 0;
        });
        const rows = Object.entries(dataMap).map(([name, d]) => {
            const topMethod = Object.entries(d.methods).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
            return { name, count: d.count, revenue: d.revenue, avg: d.count > 0 ? d.revenue / d.count : 0, topMethod, pct: totalRevenue > 0 ? (d.revenue / totalRevenue) * 100 : 0, impressions: d.impressions, likes: d.likes };
        });
        rows.sort((a, b) => {
            const mul = leaderboardDir === "desc" ? -1 : 1;
            switch (leaderboardSort) {
                case "count": return mul * (a.count - b.count);
                case "avg": return mul * (a.avg - b.avg);
                case "pct": return mul * (a.pct - b.pct);
                default: return mul * (a.revenue - b.revenue);
            }
        });
        return rows;
    }, [filteredPromos, leaderboardSort, leaderboardDir]);

    const handleLeaderboardSort = (field: LeaderboardSort) => {
        if (leaderboardSort === field) setLeaderboardDir(leaderboardDir === "desc" ? "asc" : "desc");
        else { setLeaderboardSort(field); setLeaderboardDir("desc"); }
    };

    const LeaderSortIcon = ({ field }: { field: LeaderboardSort }) => {
        if (leaderboardSort !== field) return <span className="text-white/20 ml-1">↕</span>;
        return <span className="text-accent ml-1">{leaderboardDir === "asc" ? "↑" : "↓"}</span>;
    };

    const dateRangeOptions: { value: DateRange; label: string }[] = [
        { value: "7d", label: "7 Days" },
        { value: "30d", label: "30 Days" },
        { value: "90d", label: "90 Days" },
        { value: "all", label: "All Time" },
    ];

    const selectClass = "bg-surface border border-border-light rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-accent/50 appearance-none cursor-pointer transition-all";

    return (
        <ProtectedRoute>
            <DashboardLayout>
                <div className="animate-fade-in space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Analytics</h1>
                            <p className="text-xs sm:text-sm text-text-muted mt-0.5">Insights from your promo data</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {dateRangeOptions.map((opt) => (
                                <button key={opt.value} onClick={() => setDateRange(opt.value)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${dateRange === opt.value ? "bg-accent-light text-accent border border-accent/30" : "bg-surface text-text-muted border border-border-light hover:text-text-secondary"}`}>{opt.label}</button>
                            ))}
                        </div>
                    </div>

                    {/* Filter Row */}
                    <div className="flex flex-wrap items-center gap-2">
                        <select value={filterPromoter} onChange={(e) => setFilterPromoter(e.target.value)} className={selectClass}>
                            <option value="All">All Promoters</option>
                            {uniquePromoters.map((p) => (<option key={p} value={p}>{p}</option>))}
                        </select>
                        <select value={filterAccount} onChange={(e) => setFilterAccount(e.target.value)} className={selectClass}>
                            <option value="All">All Accounts</option>
                            {uniqueAccounts.map((a) => (<option key={a} value={a}>{a}</option>))}
                        </select>
                        {hasActiveFilters && (
                            <button onClick={() => { setFilterPromoter("All"); setFilterAccount("All"); }} className="text-xs text-accent hover:text-accent/80 transition-colors ml-1">Clear filters</button>
                        )}
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mb-4" />
                            <p className="text-text-muted text-sm">Loading analytics...</p>
                        </div>
                    ) : filteredPromos.length === 0 ? (
                        <div className="text-center py-20">
                            <p className="text-text-muted text-sm">No promos match your filters.</p>
                        </div>
                    ) : (
                        <>
                            {/* Summary Stats — 5 cards */}
                            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
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
                                <div className="bg-surface border border-border-light rounded-xl p-3.5 sm:p-5 col-span-2 lg:col-span-1">
                                    <span className="text-[10px] sm:text-xs text-text-muted uppercase tracking-wider font-medium">Top Promoter</span>
                                    <p className="text-base sm:text-lg font-bold text-pink-500 mt-1 truncate">{summaryStats.topPromoterName}</p>
                                    {summaryStats.topPromoterAmount > 0 && (<p className="text-xs text-text-muted mt-0.5">${summaryStats.topPromoterAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>)}
                                </div>
                            </div>

                            {/* ── Engagement Summary Cards ── */}
                            {hasAnyEngagement && (
                                <div>
                                    <h3 className="text-sm font-semibold text-foreground mb-3">Engagement Overview</h3>
                                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                                        <div className="bg-surface border border-border-light rounded-xl p-3 sm:p-4 text-center">
                                            <span className="text-[10px] text-text-muted uppercase tracking-wider font-medium">Impressions</span>
                                            <p className="text-lg sm:text-xl font-bold text-blue-400 mt-1">{fmtNum(engagementStats.totalImpressions)}</p>
                                        </div>
                                        <div className="bg-surface border border-border-light rounded-xl p-3 sm:p-4 text-center">
                                            <span className="text-[10px] text-text-muted uppercase tracking-wider font-medium">Likes</span>
                                            <p className="text-lg sm:text-xl font-bold text-red-400 mt-1">{fmtNum(engagementStats.totalLikes)}</p>
                                        </div>
                                        <div className="bg-surface border border-border-light rounded-xl p-3 sm:p-4 text-center">
                                            <span className="text-[10px] text-text-muted uppercase tracking-wider font-medium">Comments</span>
                                            <p className="text-lg sm:text-xl font-bold text-green-400 mt-1">{fmtNum(engagementStats.totalComments)}</p>
                                        </div>
                                        <div className="bg-surface border border-border-light rounded-xl p-3 sm:p-4 text-center">
                                            <span className="text-[10px] text-text-muted uppercase tracking-wider font-medium">Bookmarks</span>
                                            <p className="text-lg sm:text-xl font-bold text-amber-400 mt-1">{fmtNum(engagementStats.totalBookmarks)}</p>
                                        </div>
                                        <div className="bg-surface border border-border-light rounded-xl p-3 sm:p-4 text-center">
                                            <span className="text-[10px] text-text-muted uppercase tracking-wider font-medium">Reposts</span>
                                            <p className="text-lg sm:text-xl font-bold text-purple-400 mt-1">{fmtNum(engagementStats.totalRetweets)}</p>
                                        </div>
                                        <div className="bg-surface border border-border-light rounded-xl p-3 sm:p-4 text-center">
                                            <span className="text-[10px] text-text-muted uppercase tracking-wider font-medium">Eng. Rate</span>
                                            <p className="text-lg sm:text-xl font-bold text-cyan-400 mt-1">{engagementStats.engagementRate.toFixed(1)}%</p>
                                            <p className="text-[10px] text-text-muted mt-0.5">{engagementStats.postsWithData} posts</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Revenue Over Time */}
                            <div className="bg-surface border border-border-light rounded-xl p-4 sm:p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-semibold text-foreground">Revenue Over Time</h3>
                                    <div className="flex gap-1">
                                        <button onClick={() => setTimeView("daily")} className={`px-2.5 py-1 rounded text-[10px] font-medium transition-all ${timeView === "daily" ? "bg-accent-light text-accent" : "text-text-muted hover:text-text-secondary"}`}>Daily</button>
                                        <button onClick={() => setTimeView("weekly")} className={`px-2.5 py-1 rounded text-[10px] font-medium transition-all ${timeView === "weekly" ? "bg-accent-light text-accent" : "text-text-muted hover:text-text-secondary"}`}>Weekly</button>
                                        <button onClick={() => setTimeView("monthly")} className={`px-2.5 py-1 rounded text-[10px] font-medium transition-all ${timeView === "monthly" ? "bg-accent-light text-accent" : "text-text-muted hover:text-text-secondary"}`}>Monthly</button>
                                    </div>
                                </div>
                                <ResponsiveContainer width="100%" height={280}>
                                    <LineChart data={revenueOverTime}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                                        <Tooltip content={<MoneyTooltip />} />
                                        <Line type="monotone" dataKey="revenue" stroke="var(--accent)" strokeWidth={2.5} dot={{ r: 4, fill: "var(--accent)" }} activeDot={{ r: 6, fill: "var(--accent)" }} name="Revenue" />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>

                            {/* ── Engagement Over Time ── */}
                            {hasAnyEngagement && engagementOverTime.length > 0 && (
                                <div className="bg-surface border border-border-light rounded-xl p-4 sm:p-6">
                                    <h3 className="text-sm font-semibold text-foreground mb-4">Engagement Over Time</h3>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={engagementOverTime}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                                            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                                            <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtNum(v)} />
                                            <Tooltip content={<NumTooltip />} />
                                            <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                                            <Bar dataKey="impressions" name="Impressions" fill={ENGAGEMENT_COLORS.impressions} radius={[2, 2, 0, 0]} />
                                            <Bar dataKey="likes" name="Likes" fill={ENGAGEMENT_COLORS.likes} radius={[2, 2, 0, 0]} />
                                            <Bar dataKey="comments" name="Comments" fill={ENGAGEMENT_COLORS.comments} radius={[2, 2, 0, 0]} />
                                            <Bar dataKey="bookmarks" name="Bookmarks" fill={ENGAGEMENT_COLORS.bookmarks} radius={[2, 2, 0, 0]} />
                                            <Bar dataKey="retweets" name="Reposts" fill={ENGAGEMENT_COLORS.retweets} radius={[2, 2, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}

                            {/* Two Column: Revenue by Account + Payment Status */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div className="bg-surface border border-border-light rounded-xl p-4 sm:p-6">
                                    <h3 className="text-sm font-semibold text-foreground mb-4">Revenue by Account</h3>
                                    <ResponsiveContainer width="100%" height={260}>
                                        <BarChart data={revenueByAccount} layout="vertical">
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                                            <XAxis type="number" tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                                            <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} width={100} />
                                            <Tooltip content={<MoneyTooltip />} />
                                            <Bar dataKey="revenue" name="Revenue" radius={[0, 4, 4, 0]}>
                                                {revenueByAccount.map((_, i) => (<Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="bg-surface border border-border-light rounded-xl p-4 sm:p-6">
                                    <h3 className="text-sm font-semibold text-foreground mb-4">Payment Status</h3>
                                    <ResponsiveContainer width="100%" height={260}>
                                        <PieChart>
                                            <Pie data={paymentStatus} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={4} dataKey="value" nameKey="name" strokeWidth={0}>
                                                {paymentStatus.map((entry) => (<Cell key={entry.name} fill={STATUS_COLORS[entry.name] || "#666"} />))}
                                            </Pie>
                                            <Tooltip content={<SimplePieTooltip />} />
                                            <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: "var(--text-secondary)" }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Two Column: Top Artists + Promo Volume */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div className="bg-surface border border-border-light rounded-xl p-4 sm:p-6">
                                    <h3 className="text-sm font-semibold text-foreground mb-4">Top Artists by Spend</h3>
                                    <ResponsiveContainer width="100%" height={280}>
                                        <BarChart data={topArtists} layout="vertical">
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                                            <XAxis type="number" tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                                            <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} width={100} />
                                            <Tooltip content={<MoneyTooltip />} />
                                            <Bar dataKey="spend" name="Total Spend" radius={[0, 4, 4, 0]} fill="#818cf8" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="bg-surface border border-border-light rounded-xl p-4 sm:p-6">
                                    <h3 className="text-sm font-semibold text-foreground mb-4">Promo Volume</h3>
                                    <ResponsiveContainer width="100%" height={280}>
                                        <AreaChart data={promoVolume}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                                            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                                            <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                                            <Tooltip content={<SimplePieTooltip />} />
                                            <Area type="monotone" dataKey="count" stroke="var(--accent)" fill="var(--accent-light)" strokeWidth={2} name="Promos" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* ── Engagement by Promoter ── */}
                            {hasAnyEngagement && engagementByPromoter.length > 0 && (
                                <div className="bg-surface border border-border-light rounded-xl p-4 sm:p-6">
                                    <h3 className="text-sm font-semibold text-foreground mb-4">Engagement by Promoter</h3>
                                    <ResponsiveContainer width="100%" height={Math.max(200, engagementByPromoter.length * 45)}>
                                        <BarChart data={engagementByPromoter} layout="vertical">
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                                            <XAxis type="number" tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtNum(v)} />
                                            <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} width={120} />
                                            <Tooltip content={<NumTooltip />} />
                                            <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                                            <Bar dataKey="impressions" name="Impressions" fill={ENGAGEMENT_COLORS.impressions} radius={[0, 2, 2, 0]} stackId="a" />
                                            <Bar dataKey="likes" name="Likes" fill={ENGAGEMENT_COLORS.likes} radius={[0, 2, 2, 0]} stackId="b" />
                                            <Bar dataKey="retweets" name="Reposts" fill={ENGAGEMENT_COLORS.retweets} radius={[0, 2, 2, 0]} stackId="c" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}

                            {/* Revenue by Promoter */}
                            <div className="bg-surface border border-border-light rounded-xl p-4 sm:p-6">
                                <h3 className="text-sm font-semibold text-foreground mb-4">Revenue by Promoter</h3>
                                {revenueByPromoter.length === 0 ? (
                                    <p className="text-sm text-text-muted py-8 text-center">No promoter data available.</p>
                                ) : (
                                    <ResponsiveContainer width="100%" height={Math.max(200, revenueByPromoter.length * 40)}>
                                        <BarChart data={revenueByPromoter} layout="vertical">
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                                            <XAxis type="number" tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                                            <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} width={120} />
                                            <Tooltip content={<MoneyTooltip />} />
                                            <Bar dataKey="revenue" name="Revenue" radius={[0, 4, 4, 0]}>
                                                {revenueByPromoter.map((_, i) => (<Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={1 - (i * 0.08)} />))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </div>

                            {/* Promoter Leaderboard */}
                            <div className="bg-surface border border-border-light rounded-xl p-4 sm:p-6">
                                <h3 className="text-sm font-semibold text-foreground mb-4">Promoter Leaderboard</h3>
                                {promoterLeaderboard.length === 0 ? (
                                    <p className="text-sm text-text-muted py-8 text-center">No promoter data available.</p>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="border-b border-border-light">
                                                    <th className="text-left px-3 py-2.5 text-xs text-text-muted uppercase tracking-wider font-medium">#</th>
                                                    <th className="text-left px-3 py-2.5 text-xs text-text-muted uppercase tracking-wider font-medium">Promoter</th>
                                                    <th onClick={() => handleLeaderboardSort("count")} className="text-left px-3 py-2.5 text-xs text-text-muted uppercase tracking-wider font-medium cursor-pointer hover:text-text-secondary transition-colors">Promos <LeaderSortIcon field="count" /></th>
                                                    <th onClick={() => handleLeaderboardSort("revenue")} className="text-left px-3 py-2.5 text-xs text-text-muted uppercase tracking-wider font-medium cursor-pointer hover:text-text-secondary transition-colors">Revenue <LeaderSortIcon field="revenue" /></th>
                                                    <th onClick={() => handleLeaderboardSort("avg")} className="text-left px-3 py-2.5 text-xs text-text-muted uppercase tracking-wider font-medium cursor-pointer hover:text-text-secondary transition-colors">Avg Value <LeaderSortIcon field="avg" /></th>
                                                    <th className="text-left px-3 py-2.5 text-xs text-text-muted uppercase tracking-wider font-medium">Top Method</th>
                                                    {hasAnyEngagement && <th className="text-left px-3 py-2.5 text-xs text-text-muted uppercase tracking-wider font-medium">Impressions</th>}
                                                    {hasAnyEngagement && <th className="text-left px-3 py-2.5 text-xs text-text-muted uppercase tracking-wider font-medium">Likes</th>}
                                                    <th onClick={() => handleLeaderboardSort("pct")} className="text-right px-3 py-2.5 text-xs text-text-muted uppercase tracking-wider font-medium cursor-pointer hover:text-text-secondary transition-colors">% Rev <LeaderSortIcon field="pct" /></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {promoterLeaderboard.map((row, i) => (
                                                    <tr key={row.name} className="border-b border-border-light/50 hover:bg-surface-hover transition-colors">
                                                        <td className="px-3 py-3 text-sm text-text-muted font-medium">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`}</td>
                                                        <td className="px-3 py-3 text-sm text-foreground font-medium">{row.name}</td>
                                                        <td className="px-3 py-3 text-sm text-text-secondary">{row.count}</td>
                                                        <td className="px-3 py-3 text-sm text-accent font-medium">${row.revenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                                                        <td className="px-3 py-3 text-sm text-text-secondary">${row.avg.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                                                        <td className="px-3 py-3 text-sm text-text-muted">{row.topMethod}</td>
                                                        {hasAnyEngagement && <td className="px-3 py-3 text-sm text-blue-400">{row.impressions > 0 ? fmtNum(row.impressions) : "—"}</td>}
                                                        {hasAnyEngagement && <td className="px-3 py-3 text-sm text-red-400">{row.likes > 0 ? fmtNum(row.likes) : "—"}</td>}
                                                        <td className="px-3 py-3 text-sm text-right">
                                                            <div className="flex items-center justify-end gap-2">
                                                                <div className="w-16 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                                                                    <div className="h-full bg-accent rounded-full" style={{ width: `${Math.min(row.pct, 100)}%` }} />
                                                                </div>
                                                                <span className="text-text-muted">{row.pct.toFixed(1)}%</span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
