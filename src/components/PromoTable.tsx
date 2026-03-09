"use client";

import { Promo, PAYMENT_METHODS } from "@/lib/types";
import { Timestamp } from "firebase/firestore";
import { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface PromoTableProps {
    promos: Promo[];
    onEdit: (promo: Promo) => void;
    onDelete: (id: string) => Promise<void>;
    onDuplicate: (promo: Promo) => void;
    onCancelSeries?: (groupId: string) => Promise<void>;
    onBulkUpdateStatus?: (ids: string[], status: string) => Promise<void>;
    onLinkBundle?: (ids: string[]) => Promise<void>;
    filterStatus: string;
    setFilterStatus: (status: string) => void;
}

type SortField = "promoDate" | "promoting" | "paymentAmount" | "paymentStatus";
type SortDir = "asc" | "desc";
type RecurringFilter = "all" | "recurring" | "onetime";

function fmtNum(n: number): string {
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(n % 1_000_000_000 === 0 ? 0 : 1)}B`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}K`;
    return String(n);
}

function formatDate(ts: Timestamp): string {
    if (!ts || !ts.toDate) return "—";
    return ts.toDate().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

function getStatusColor(status: string) {
    switch (status) {
        case "Paid":
            return "bg-green-500/15 text-green-400 border-green-500/20";
        case "Pending":
            return "bg-amber-500/15 text-amber-400 border-amber-500/20";
        case "Overdue":
            return "bg-red-500/15 text-red-400 border-red-500/20";
        default:
            return "bg-white/10 text-white/60";
    }
}

export default function PromoTable({ promos, onEdit,
    onDelete,
    onDuplicate,
    onCancelSeries,
    onBulkUpdateStatus,
    onLinkBundle,
    filterStatus,
    setFilterStatus,
}: PromoTableProps) {
    const [search, setSearch] = useState("");
    const [filterAccount, setFilterAccount] = useState<string>("All");
    const [filterRecurring, setFilterRecurring] = useState<RecurringFilter>("all");
    const [filterIsBundle, setFilterIsBundle] = useState<"all" | "bundle" | "non-bundle">("all");
    const [filterPromoter, setFilterPromoter] = useState<string>("All");
    const [filterArtist, setFilterArtist] = useState<string>("All");
    const [filterBundleGroupId, setFilterBundleGroupId] = useState<string | null>(null);
    const [filterPaymentMethod, setFilterPaymentMethod] = useState<string>("All");
    const [filterDateFrom, setFilterDateFrom] = useState("");
    const [filterDateTo, setFilterDateTo] = useState("");
    const [sortField, setSortField] = useState<SortField>("promoDate");
    const [sortDir, setSortDir] = useState<SortDir>("desc");
    const [showFilters, setShowFilters] = useState(false);

    // Select mode
    const [selectMode, setSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkLoading, setBulkLoading] = useState(false);
    const [toast, setToast] = useState("");
    const [showPromoterSelect, setShowPromoterSelect] = useState(false);
    const [sidebarEl, setSidebarEl] = useState<HTMLElement | null>(null);

    useEffect(() => {
        setSidebarEl(document.getElementById("sidebar-actions"));
    }, []);

    const uniqueAccounts = useMemo(() => [...new Set(promos.map((p) => p.accountHandle))].sort(), [promos]);
    const uniquePromoters = useMemo(() => [...new Set(promos.map((p) => p.promoterName).filter(Boolean))].sort(), [promos]);
    const uniqueArtists = useMemo(() => [...new Set(promos.map((p) => p.promoting).filter(Boolean))].sort(), [promos]);

    const hasActiveFilters = filterStatus !== "All" || filterAccount !== "All" || filterRecurring !== "all" || filterIsBundle !== "all" || filterPromoter !== "All" || filterArtist !== "All" || filterPaymentMethod !== "All" || filterDateFrom || filterDateTo || filterBundleGroupId;

    const clearAllFilters = () => {
        setFilterStatus("All");
        setFilterAccount("All");
        setFilterRecurring("all");
        setFilterIsBundle("all");
        setFilterPromoter("All");
        setFilterArtist("All");
        setFilterPaymentMethod("All");
        setFilterDateFrom("");
        setFilterDateTo("");
        setFilterBundleGroupId(null);
    };

    const filteredAndSorted = useMemo(() => {
        let result = [...promos];

        if (search) {
            const q = search.toLowerCase();
            result = result.filter(
                (p) =>
                    p.promoting.toLowerCase().includes(q) ||
                    p.promoterName.toLowerCase().includes(q) ||
                    p.accountHandle.toLowerCase().includes(q)
            );
        }

        if (filterStatus !== "All") result = result.filter((p) => p.paymentStatus === filterStatus);
        if (filterAccount !== "All") result = result.filter((p) => p.accountHandle === filterAccount);
        if (filterPromoter !== "All") result = result.filter((p) => p.promoterName === filterPromoter);
        if (filterArtist !== "All") result = result.filter((p) => p.promoting === filterArtist);
        if (filterPaymentMethod !== "All") result = result.filter((p) => p.paymentMethod === filterPaymentMethod);

        if (filterRecurring === "recurring") {
            result = result.filter((p) => p.isRecurring);
        } else if (filterRecurring === "onetime") {
            result = result.filter((p) => !p.isRecurring);
        }

        if (filterIsBundle === "bundle") {
            result = result.filter((p) => p.isBundle);
        } else if (filterIsBundle === "non-bundle") {
            result = result.filter((p) => !p.isBundle);
        }

        if (filterDateFrom) {
            const from = new Date(filterDateFrom);
            result = result.filter((p) => p.promoDate?.toDate() >= from);
        }
        if (filterDateTo) {
            const to = new Date(filterDateTo);
            to.setHours(23, 59, 59);
            result = result.filter((p) => p.promoDate?.toDate() <= to);
        }

        if (filterBundleGroupId) {
            result = result.filter((p) => p.bundleGroupId === filterBundleGroupId);
        }

        result.sort((a, b) => {
            let cmp = 0;
            switch (sortField) {
                case "promoDate":
                    cmp = (a.promoDate?.toMillis() || 0) - (b.promoDate?.toMillis() || 0);
                    break;
                case "promoting":
                    cmp = a.promoting.localeCompare(b.promoting);
                    break;
                case "paymentAmount":
                    cmp = a.paymentAmount - b.paymentAmount;
                    break;
                case "paymentStatus":
                    cmp = a.paymentStatus.localeCompare(b.paymentStatus);
                    break;
            }
            return sortDir === "desc" ? -cmp : cmp;
        });

        return result;
    }, [promos, search, filterStatus, filterAccount, filterPromoter, filterArtist, filterPaymentMethod, filterRecurring, filterIsBundle, filterDateFrom, filterDateTo, filterBundleGroupId, sortField, sortDir]);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDir(sortDir === "asc" ? "desc" : "asc");
        } else {
            setSortField(field);
            setSortDir("desc");
        }
    };

    const toggleSelect = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        const visibleIds = filteredAndSorted.map((p) => p.id!).filter(Boolean);
        const allSelected = visibleIds.every((id) => selectedIds.has(id));
        if (allSelected) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(visibleIds));
        }
    };

    const selectByPromoter = (promoterName: string) => {
        const ids = filteredAndSorted.filter((p) => p.promoterName === promoterName && p.id).map((p) => p.id!);
        setSelectedIds((prev) => {
            const next = new Set(prev);
            ids.forEach((id) => next.add(id));
            return next;
        });
        setShowPromoterSelect(false);
    };

    const handleBulkAction = async (status: string) => {
        if (!onBulkUpdateStatus || selectedIds.size === 0) return;
        setBulkLoading(true);
        try {
            await onBulkUpdateStatus(Array.from(selectedIds), status);
            setToast(`${selectedIds.size} promo${selectedIds.size !== 1 ? "s" : ""} marked as ${status}`);
            setSelectedIds(new Set());
            setSelectMode(false);
            setTimeout(() => setToast(""), 3000);
        } catch {
            setToast("Failed to update promos.");
            setTimeout(() => setToast(""), 3000);
        } finally {
            setBulkLoading(false);
        }
    };

    const handleLinkBundle = async () => {
        if (!onLinkBundle || selectedIds.size === 0) return;
        setBulkLoading(true);
        try {
            await onLinkBundle(Array.from(selectedIds));
            setToast(`${selectedIds.size} promo${selectedIds.size !== 1 ? "s" : ""} linked as a bundle`);
            setSelectedIds(new Set());
            setSelectMode(false);
            setTimeout(() => setToast(""), 3000);
        } catch {
            setToast("Failed to link promos.");
            setTimeout(() => setToast(""), 3000);
        } finally {
            setBulkLoading(false);
        }
    };

    const exitSelectMode = () => {
        setSelectMode(false);
        setSelectedIds(new Set());
        setShowPromoterSelect(false);
    };

    // Unique promoters in current filtered view (for "Select by Promoter")
    const visiblePromoters = useMemo(() => [...new Set(filteredAndSorted.map((p) => p.promoterName).filter(Boolean))].sort(), [filteredAndSorted]);

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return <span className="text-white/20 ml-1">↕</span>;
        return <span className="text-accent ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>;
    };

    const RecurringIcon = () => (
        <svg className="w-3.5 h-3.5 text-accent/60 inline-block ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.182" />
        </svg>
    );

    const selectCls = "w-full bg-white/[0.06] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/50 appearance-none cursor-pointer";

    return (
        <div className="space-y-4">
            {/* Search & Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                    </svg>
                    <input type="text" placeholder="Search by name, promoter, or account..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25 transition-all" />
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setShowFilters(!showFilters)} className={`px-4 py-2.5 rounded-lg border text-sm transition-all flex items-center gap-2 ${showFilters ? "bg-accent/10 border-accent/30 text-accent" : "bg-white/[0.04] border-white/[0.08] text-white/50 hover:text-white/70"}`}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
                        </svg>
                        Filters
                    </button>
                    {onBulkUpdateStatus && (
                        <button
                            onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)}
                            className={`px-4 py-2.5 rounded-lg border text-sm transition-all flex items-center gap-2 ${selectMode ? "bg-accent/10 border-accent/30 text-accent" : "bg-white/[0.04] border-white/[0.08] text-white/50 hover:text-white/70"}`}
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {selectMode ? "Cancel" : "Select"}
                        </button>
                    )}
                </div>
            </div>

            {/* Expandable Filters */}
            {showFilters && (
                <div className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-lg animate-fade-in space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                        <div>
                            <label className="block text-xs text-white/40 mb-1.5 uppercase tracking-wider">Status</label>
                            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={selectCls}>
                                <option value="All">All Statuses</option>
                                <option value="Pending">Pending</option>
                                <option value="Paid">Paid</option>
                                <option value="Overdue">Overdue</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-white/40 mb-1.5 uppercase tracking-wider">Account</label>
                            <select value={filterAccount} onChange={(e) => setFilterAccount(e.target.value)} className={selectCls}>
                                <option value="All">All Accounts</option>
                                {uniqueAccounts.map((acc) => (<option key={acc} value={acc}>{acc}</option>))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-white/40 mb-1.5 uppercase tracking-wider">Promoter</label>
                            <select value={filterPromoter} onChange={(e) => setFilterPromoter(e.target.value)} className={selectCls}>
                                <option value="All">All Promoters</option>
                                {uniquePromoters.map((p) => (<option key={p} value={p}>{p}</option>))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-white/40 mb-1.5 uppercase tracking-wider">Artist</label>
                            <select value={filterArtist} onChange={(e) => setFilterArtist(e.target.value)} className={selectCls}>
                                <option value="All">All Artists</option>
                                {uniqueArtists.map((a) => (<option key={a} value={a}>{a}</option>))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-white/40 mb-1.5 uppercase tracking-wider">Bundle Status</label>
                            <select value={filterIsBundle} onChange={(e) => setFilterIsBundle(e.target.value as any)} className={selectCls}>
                                <option value="all">All Posts</option>
                                <option value="bundle">Bundle Posts Only</option>
                                <option value="non-bundle">Non-Bundle Posts Only</option>
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div>
                            <label className="block text-xs text-white/40 mb-1.5 uppercase tracking-wider">Payment Method</label>
                            <select value={filterPaymentMethod} onChange={(e) => setFilterPaymentMethod(e.target.value)} className={selectCls}>
                                <option value="All">All Methods</option>
                                {PAYMENT_METHODS.map((m) => (<option key={m} value={m}>{m}</option>))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-white/40 mb-1.5 uppercase tracking-wider">Type</label>
                            <select value={filterRecurring} onChange={(e) => setFilterRecurring(e.target.value as RecurringFilter)} className={selectCls}>
                                <option value="all">All Types</option>
                                <option value="recurring">Recurring Only</option>
                                <option value="onetime">One-time Only</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-white/40 mb-1.5 uppercase tracking-wider">From Date</label>
                            <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="w-full bg-white/[0.06] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/50" />
                        </div>
                        <div>
                            <label className="block text-xs text-white/40 mb-1.5 uppercase tracking-wider">To Date</label>
                            <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="w-full bg-white/[0.06] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/50" />
                        </div>
                    </div>
                    {hasActiveFilters && (
                        <div className="flex items-center gap-4">
                            <button onClick={() => { clearAllFilters(); }} className="text-xs text-accent hover:text-accent/80 transition-colors">
                                ✕ Clear all filters
                            </button>
                            {filterBundleGroupId && (
                                <span className="text-xs text-white/50 bg-white/5 px-2 py-1 rounded">Filtered by Bundle</span>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Select Mode Header */}
            {selectMode && (
                <div className="flex items-center gap-3 px-4 py-2.5 bg-accent/5 border border-accent/20 rounded-lg animate-fade-in">
                    <label className="flex items-center gap-2 cursor-pointer text-sm text-text-muted hover:text-foreground transition-colors">
                        <input type="checkbox" checked={filteredAndSorted.length > 0 && filteredAndSorted.every((p) => p.id && selectedIds.has(p.id))} onChange={toggleSelectAll} className="w-4 h-4 rounded border-border-light accent-accent cursor-pointer" />
                        Select All
                    </label>
                    <div className="relative">
                        <button onClick={() => setShowPromoterSelect(!showPromoterSelect)} className="px-3 py-1.5 rounded-lg border border-border-light text-xs text-text-muted hover:text-foreground hover:border-accent/30 transition-all flex items-center gap-1">
                            Select by Promoter
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                        </button>
                        {showPromoterSelect && (
                            <div className="absolute top-full left-0 mt-1 w-48 bg-surface border border-border-light rounded-lg shadow-xl z-30 py-1 max-h-48 overflow-y-auto animate-fade-in">
                                {visiblePromoters.map((name) => (
                                    <button key={name} onClick={() => selectByPromoter(name)} className="w-full text-left px-3 py-2 text-sm text-text-secondary hover:bg-surface-hover hover:text-foreground transition-colors">
                                        {name}
                                    </button>
                                ))}
                                {visiblePromoters.length === 0 && <p className="px-3 py-2 text-xs text-text-muted">No promoters</p>}
                            </div>
                        )}
                    </div>
                    <span className="text-xs text-text-muted ml-auto">{selectedIds.size} selected</span>
                </div>
            )}

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-border-light">
                            {selectMode && <th className="w-10 px-3 py-3"></th>}
                            <th onClick={() => handleSort("promoDate")} className="text-left px-4 py-3 text-xs text-text-muted uppercase tracking-wider font-medium cursor-pointer hover:text-text-secondary transition-colors">Date <SortIcon field="promoDate" /></th>
                            <th onClick={() => handleSort("promoting")} className="text-left px-4 py-3 text-xs text-text-muted uppercase tracking-wider font-medium cursor-pointer hover:text-text-secondary transition-colors">Promoting <SortIcon field="promoting" /></th>
                            <th className="text-left px-4 py-3 text-xs text-text-muted uppercase tracking-wider font-medium">Account</th>
                            <th className="text-left px-4 py-3 text-xs text-text-muted uppercase tracking-wider font-medium">Promoter</th>
                            <th onClick={() => handleSort("paymentAmount")} className="text-left px-4 py-3 text-xs text-text-muted uppercase tracking-wider font-medium cursor-pointer hover:text-text-secondary transition-colors">Amount <SortIcon field="paymentAmount" /></th>
                            <th onClick={() => handleSort("paymentStatus")} className="text-left px-4 py-3 text-xs text-text-muted uppercase tracking-wider font-medium cursor-pointer hover:text-text-secondary transition-colors">Status <SortIcon field="paymentStatus" /></th>
                            <th className="text-center px-4 py-3 text-xs text-text-muted uppercase tracking-wider font-medium">Link</th>
                            <th className="text-right px-4 py-3 text-xs text-text-muted uppercase tracking-wider font-medium">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredAndSorted.length === 0 ? (
                            <tr>
                                <td colSpan={selectMode ? 9 : 8} className="text-center py-12 text-white/30 text-sm">
                                    {promos.length === 0 ? 'No promos yet. Click "Add Promo" to get started.' : "No promos match your filters."}
                                </td>
                            </tr>
                        ) : (
                            filteredAndSorted.map((promo) => (
                                <tr key={promo.id} className={`border-b border-border-light hover:bg-surface-hover transition-colors cursor-pointer group ${selectedIds.has(promo.id!) ? "bg-accent/5" : ""}`} onClick={() => selectMode ? (promo.id && toggleSelect(promo.id)) : onEdit(promo)}>
                                    {selectMode && (
                                        <td className="px-3 py-3.5">
                                            <input type="checkbox" checked={!!promo.id && selectedIds.has(promo.id)} onChange={() => promo.id && toggleSelect(promo.id)} onClick={(e) => e.stopPropagation()} className="w-4 h-4 rounded border-border-light accent-accent cursor-pointer" />
                                        </td>
                                    )}
                                    <td className="px-4 py-3.5 text-sm text-text-secondary">
                                        {formatDate(promo.promoDate)}
                                        {promo.isRecurring && <RecurringIcon />}
                                    </td>
                                    <td className="px-4 py-3.5 text-sm text-foreground font-medium">
                                        <div className="flex items-center gap-2">
                                            {promo.promoting}
                                            {promo.isBundle && promo.bundleCount && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setShowFilters(true); setFilterBundleGroupId(promo.bundleGroupId || null); }}
                                                    className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors ${promo.bundleGroupId ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30 hover:bg-purple-500/20" : "bg-white/5 text-text-muted border-white/10 hover:bg-white/10"}`}
                                                    title={promo.bundleGroupId ? "View all promos in this bundle" : "Bundle post"}
                                                >
                                                    {promo.bundleIndex ? `${promo.bundleIndex}/${promo.bundleCount}` : `${promo.bundleCount}x`}
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3.5 text-sm text-accent font-mono">{promo.accountHandle}</td>
                                    <td className="px-4 py-3.5 text-sm text-text-muted">{promo.promoterName}</td>
                                    <td className="px-4 py-3.5 text-sm text-foreground font-medium">${promo.paymentAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                                    <td className="px-4 py-3.5">
                                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(promo.paymentStatus)}`}>{promo.paymentStatus}</span>
                                    </td>
                                    <td className="px-4 py-3.5 text-center">
                                        {promo.tweetLink ? (
                                            <a href={promo.tweetLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center p-1.5 text-text-muted hover:text-accent hover:bg-surface-hover rounded-md transition-all" title="View Link" onClick={(e) => e.stopPropagation()}>
                                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                                                </svg>
                                            </a>
                                        ) : (
                                            <span className="text-text-muted opacity-50">—</span>
                                        )}
                                        {(promo.impressions || promo.likes || promo.comments || promo.bookmarks || promo.retweets) && (
                                            <div className="flex items-center justify-center gap-2 mt-1 text-[10px] text-text-muted">
                                                {promo.impressions != null && <span title="Impressions">{fmtNum(promo.impressions)} imp</span>}
                                                {promo.likes != null && <span title="Likes">❤️ {promo.likes}</span>}
                                                {promo.retweets != null && <span title="Reposts">🔁 {promo.retweets}</span>}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-4 py-3.5 text-right">
                                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={(e) => { e.stopPropagation(); onDuplicate(promo); }} className="p-1.5 text-white/40 hover:text-accent rounded-md hover:bg-white/[0.06] transition-all" title="Duplicate">
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                                                </svg>
                                            </button>
                                            {promo.isRecurring && promo.recurringGroupId && onCancelSeries && (
                                                <button onClick={(e) => { e.stopPropagation(); if (confirm("Cancel all future pending promos in this series?")) onCancelSeries(promo.recurringGroupId!); }} className="p-1.5 text-white/40 hover:text-amber-400 rounded-md hover:bg-white/[0.06] transition-all" title="Cancel Series">
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                                    </svg>
                                                </button>
                                            )}
                                            <button onClick={(e) => { e.stopPropagation(); onEdit(promo); }} className="p-1.5 text-white/40 hover:text-accent rounded-md hover:bg-white/[0.06] transition-all" title="Edit">
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                                                </svg>
                                            </button>
                                            <button onClick={(e) => { e.stopPropagation(); if (promo.id && confirm("Delete this promo?")) { onDelete(promo.id); } }} className="p-1.5 text-white/40 hover:text-red-400 rounded-md hover:bg-white/[0.06] transition-all" title="Delete">
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                                </svg>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
                {filteredAndSorted.length === 0 ? (
                    <div className="text-center py-12 text-text-muted text-sm">
                        {promos.length === 0 ? 'No promos yet. Tap "Add Promo" to get started.' : "No promos match your filters."}
                    </div>
                ) : (
                    filteredAndSorted.map((promo) => (
                        <div key={promo.id} onClick={() => selectMode ? (promo.id && toggleSelect(promo.id)) : onEdit(promo)} className={`bg-surface border border-border-light rounded-xl p-4 active:bg-surface-hover transition-all cursor-pointer ${selectedIds.has(promo.id!) ? "ring-1 ring-accent/40 bg-accent/5" : ""}`}>
                            <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    {selectMode && (
                                        <input type="checkbox" checked={!!promo.id && selectedIds.has(promo.id)} onChange={() => promo.id && toggleSelect(promo.id)} onClick={(e) => e.stopPropagation()} className="w-4 h-4 rounded border-border-light accent-accent cursor-pointer" />
                                    )}
                                    <div>
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <p className="text-foreground font-medium">
                                                {promo.promoting}
                                                {promo.isRecurring && <RecurringIcon />}
                                            </p>
                                            {promo.isBundle && promo.bundleCount && (
                                                <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                                                    {promo.bundleIndex ? `${promo.bundleIndex}/${promo.bundleCount}` : `${promo.bundleCount}x`}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-accent text-sm font-mono">{promo.accountHandle}</p>
                                    </div>
                                </div>
                                <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(promo.paymentStatus)}`}>{promo.paymentStatus}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-text-secondary">{formatDate(promo.promoDate)}</span>
                                <span className="text-foreground font-medium">${promo.paymentAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs mt-1.5">
                                <span className="text-text-muted">{promo.promoterName}</span>
                                <span className="text-text-muted">{promo.paymentMethod}</span>
                            </div>
                            {promo.tweetLink && (
                                <a href={promo.tweetLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-2.5 text-xs text-text-muted hover:text-accent transition-colors" onClick={(e) => e.stopPropagation()}>
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                                    </svg>
                                    View Link
                                </a>
                            )}
                            {(promo.impressions || promo.likes || promo.comments || promo.bookmarks || promo.retweets) && (
                                <div className="flex items-center gap-3 mt-2 text-[11px] text-text-muted">
                                    {promo.impressions != null && <span>{fmtNum(promo.impressions)} imp</span>}
                                    {promo.likes != null && <span>❤️ {promo.likes}</span>}
                                    {promo.comments != null && <span>💬 {promo.comments}</span>}
                                    {promo.bookmarks != null && <span>🔖 {promo.bookmarks}</span>}
                                    {promo.retweets != null && <span>🔁 {promo.retweets}</span>}
                                </div>
                            )}
                            {promo.notes && (<p className="text-xs text-text-muted mt-2 truncate">{promo.notes}</p>)}
                            {!selectMode && (
                                <div className="flex justify-end gap-3 mt-3 pt-2 border-t border-border-light">
                                    <button onClick={(e) => { e.stopPropagation(); onDuplicate(promo); }} className="text-xs text-accent hover:text-accent-light transition-colors">Duplicate</button>
                                    {promo.isRecurring && promo.recurringGroupId && onCancelSeries && (
                                        <button onClick={(e) => { e.stopPropagation(); if (confirm("Cancel all future pending promos in this series?")) onCancelSeries(promo.recurringGroupId!); }} className="text-xs text-amber-500 hover:text-amber-400 transition-colors">Cancel Series</button>
                                    )}
                                    <button onClick={(e) => { e.stopPropagation(); onEdit(promo); }} className="text-xs text-accent hover:text-accent-light transition-colors">Edit</button>
                                    <button onClick={(e) => { e.stopPropagation(); if (promo.id && confirm("Delete this promo?")) { onDelete(promo.id); } }} className="text-xs text-red-500 hover:text-red-400 transition-colors">Delete</button>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Result count */}
            {promos.length > 0 && (
                <p className="text-xs text-white/30 text-right">
                    Showing {filteredAndSorted.length} of {promos.length} promo{promos.length !== 1 ? "s" : ""}
                </p>
            )}

            {/* Sidebar Portal — renders inside the actual sidebar */}
            {selectMode && selectedIds.size > 0 && sidebarEl && createPortal(
                <div className="p-3 bg-surface/95 backdrop-blur-md border border-border-light rounded-xl shadow-lg space-y-2.5 mt-2 animate-fade-in">
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-foreground font-semibold">{selectedIds.size} selected</span>
                        <button onClick={exitSelectMode} className="text-[10px] text-text-muted hover:text-foreground transition-colors">✕</button>
                    </div>
                    <div className="space-y-1.5">
                        <button disabled={bulkLoading} onClick={() => handleBulkAction("Paid")} className="w-full px-3 py-2 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 text-xs font-medium hover:bg-green-500/20 transition-all disabled:opacity-50 text-left">Mark as Paid</button>
                        <button disabled={bulkLoading} onClick={() => handleBulkAction("Pending")} className="w-full px-3 py-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-medium hover:bg-amber-500/20 transition-all disabled:opacity-50 text-left">Mark as Pending</button>
                        <button disabled={bulkLoading} onClick={() => handleBulkAction("Overdue")} className="w-full px-3 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-medium hover:bg-red-500/20 transition-all disabled:opacity-50 text-left">Mark as Overdue</button>
                    </div>
                    {bulkLoading && <div className="flex justify-center"><div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>}
                </div>,
                sidebarEl
            )}

            {/* Mobile: compact bar at top */}
            {selectMode && selectedIds.size > 0 && (
                <div className="md:hidden fixed top-[52px] left-0 right-0 z-40 px-3 py-2 bg-surface/95 backdrop-blur-md border-b border-border-light animate-fade-in">
                    <div className="flex items-center gap-2 overflow-x-auto">
                        <span className="text-xs text-foreground font-semibold whitespace-nowrap">{selectedIds.size} sel.</span>
                        <button disabled={bulkLoading} onClick={() => handleBulkAction("Paid")} className="px-2.5 py-1.5 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 text-[11px] font-medium hover:bg-green-500/20 disabled:opacity-50 whitespace-nowrap">Paid</button>
                        <button disabled={bulkLoading} onClick={() => handleBulkAction("Pending")} className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[11px] font-medium hover:bg-amber-500/20 disabled:opacity-50 whitespace-nowrap">Pending</button>
                        <button disabled={bulkLoading} onClick={() => handleBulkAction("Overdue")} className="px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-[11px] font-medium hover:bg-red-500/20 disabled:opacity-50 whitespace-nowrap">Overdue</button>
                        <button onClick={exitSelectMode} className="text-[11px] text-text-muted hover:text-foreground whitespace-nowrap ml-auto">Cancel</button>
                    </div>
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div className="fixed bottom-6 right-6 z-50 px-4 py-3 bg-surface border border-border-light rounded-xl shadow-2xl text-sm text-foreground animate-fade-in">
                    {toast}
                </div>
            )}
        </div>
    );
}
