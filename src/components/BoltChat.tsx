"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Promo } from "@/lib/types";
import BoltIcon from "./BoltIcon";

interface Message {
    role: "user" | "assistant";
    content: string;
}

interface BoltChatProps {
    promos: Promo[];
}

function buildDataContext(promos: Promo[]) {
    const totalRevenue = promos.reduce((s, p) => s + p.paymentAmount, 0);
    const pendingPromos = promos.filter((p) => p.paymentStatus === "Pending");
    const paidPromos = promos.filter((p) => p.paymentStatus === "Paid");
    const overduePromos = promos.filter((p) => p.paymentStatus === "Overdue");
    const pendingRevenue = pendingPromos.reduce((s, p) => s + p.paymentAmount, 0);
    const paidRevenue = paidPromos.reduce((s, p) => s + p.paymentAmount, 0);
    const overdueRevenue = overduePromos.reduce((s, p) => s + p.paymentAmount, 0);

    // Top promoters
    const promoterMap: Record<string, { totalRevenue: number; promoCount: number; pendingAmount: number }> = {};
    promos.forEach((p) => {
        if (!promoterMap[p.promoterName]) promoterMap[p.promoterName] = { totalRevenue: 0, promoCount: 0, pendingAmount: 0 };
        promoterMap[p.promoterName].totalRevenue += p.paymentAmount;
        promoterMap[p.promoterName].promoCount += 1;
        if (p.paymentStatus === "Pending") promoterMap[p.promoterName].pendingAmount += p.paymentAmount;
    });
    const topPromoters = Object.entries(promoterMap)
        .map(([name, d]) => ({ name, ...d }))
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, 10);

    // Top artists
    const artistMap: Record<string, { totalRevenue: number; promoCount: number }> = {};
    promos.forEach((p) => {
        const name = p.promoting || "Unknown";
        if (!artistMap[name]) artistMap[name] = { totalRevenue: 0, promoCount: 0 };
        artistMap[name].totalRevenue += p.paymentAmount;
        artistMap[name].promoCount += 1;
    });
    const topArtists = Object.entries(artistMap)
        .map(([name, d]) => ({ name, ...d }))
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, 10);

    // Top accounts
    const accountMap: Record<string, { totalRevenue: number; promoCount: number }> = {};
    promos.forEach((p) => {
        if (!accountMap[p.accountHandle]) accountMap[p.accountHandle] = { totalRevenue: 0, promoCount: 0 };
        accountMap[p.accountHandle].totalRevenue += p.paymentAmount;
        accountMap[p.accountHandle].promoCount += 1;
    });
    const topAccounts = Object.entries(accountMap)
        .map(([handle, d]) => ({ handle, ...d }))
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, 10);

    // Top labels
    const labelMap: Record<string, { totalRevenue: number; promoCount: number }> = {};
    promos.forEach((p) => {
        if (p.artistLabel) {
            if (!labelMap[p.artistLabel]) labelMap[p.artistLabel] = { totalRevenue: 0, promoCount: 0 };
            labelMap[p.artistLabel].totalRevenue += p.paymentAmount;
            labelMap[p.artistLabel].promoCount += 1;
        }
    });
    const topLabels = Object.entries(labelMap)
        .map(([name, d]) => ({ name, ...d }))
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, 10);

    // Monthly revenue
    const monthlyMap: Record<string, { revenue: number; promoCount: number }> = {};
    promos.forEach((p) => {
        const d = p.promoDate?.toDate();
        if (!d) return;
        const key = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
        if (!monthlyMap[key]) monthlyMap[key] = { revenue: 0, promoCount: 0 };
        monthlyMap[key].revenue += p.paymentAmount;
        monthlyMap[key].promoCount += 1;
    });
    const monthlyRevenue = Object.entries(monthlyMap)
        .map(([month, d]) => ({ month, ...d }))
        .sort((a, b) => {
            const da = new Date(a.month);
            const db = new Date(b.month);
            return db.getTime() - da.getTime();
        });

    // Recent promos (last 20)
    const sorted = [...promos].sort((a, b) => (b.promoDate?.toMillis() || 0) - (a.promoDate?.toMillis() || 0));
    const recentPromos = sorted.slice(0, 20).map((p) => ({
        date: p.promoDate?.toDate().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) || "—",
        promoting: p.promoting,
        label: p.artistLabel || null,
        account: p.accountHandle,
        promoter: p.promoterName,
        amount: p.paymentAmount,
        method: p.paymentMethod,
        status: p.paymentStatus,
        isBundle: p.isBundle || false,
        bundleCount: p.bundleCount || null,
    }));

    return {
        totalPromos: promos.length,
        totalRevenue,
        pendingRevenue,
        paidRevenue,
        overdueRevenue,
        pendingCount: pendingPromos.length,
        paidCount: paidPromos.length,
        overdueCount: overduePromos.length,
        topPromoters,
        topArtists,
        topAccounts,
        topLabels,
        recentPromos,
        monthlyRevenue,
    };
}

function formatBoltMessage(text: string) {
    // Bold: **text**
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
            return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
        }
        // Line breaks
        const lines = part.split("\n");
        return lines.map((line, j) => (
            <span key={`${i}-${j}`}>
                {j > 0 && <br />}
                {line}
            </span>
        ));
    });
}

export default function BoltChat({ promos }: BoltChatProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [hasOpened, setHasOpened] = useState(false);
    const [apiError, setApiError] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, loading]);

    // Focus input on open
    useEffect(() => {
        if (isOpen && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 300);
        }
    }, [isOpen]);

    const handleOpen = useCallback(() => {
        setIsOpen(true);
        setHasOpened(true);
    }, []);

    const handleSend = async () => {
        const trimmed = input.trim();
        if (!trimmed || loading) return;

        const userMessage: Message = { role: "user", content: trimmed };
        const newMessages = [...messages, userMessage];
        setMessages(newMessages);
        setInput("");
        setLoading(true);
        setApiError(null);

        try {
            const dataContext = buildDataContext(promos);

            const res = await fetch("/api/bolt", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: newMessages,
                    dataContext,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                const errorMsg = data.message || "Couldn't process that — try again in a moment.";
                if (data.error === "api_key_missing") {
                    setApiError(errorMsg);
                    setMessages((prev) => [...prev, { role: "assistant", content: errorMsg }]);
                } else {
                    setMessages((prev) => [...prev, { role: "assistant", content: errorMsg }]);
                }
            } else if (data.reply) {
                setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
            } else {
                setMessages((prev) => [...prev, { role: "assistant", content: "Something went wrong. Try rephrasing your question." }]);
            }
        } catch {
            setMessages((prev) => [...prev, { role: "assistant", content: "Couldn't process that — try again in a moment." }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {/* Floating Button */}
            <button
                onClick={handleOpen}
                className={`fixed z-30 w-14 h-14 rounded-full bg-accent shadow-lg shadow-accent/30 flex items-center justify-center transition-all hover:scale-105 active:scale-95 ${
                    isOpen ? "opacity-0 pointer-events-none scale-75" : "opacity-100"
                } ${!hasOpened ? "animate-bolt-pulse" : ""}`}
                style={{ bottom: "88px", right: "16px" }}
                aria-label="Open Bolt AI Chat"
            >
                <BoltIcon size={28} className="text-white" />
            </button>

            {/* Chat Panel */}
            {isOpen && (
                <div
                    className={`fixed z-40 flex flex-col bg-background border border-border-light shadow-2xl overflow-hidden
                        bottom-0 right-0 w-full h-[75dvh]
                        md:bottom-4 md:right-4 md:w-[400px] md:h-[500px] md:rounded-2xl
                        animate-bolt-slide-up`}
                >
                    {/* Header */}
                    <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border-light shrink-0 bg-surface/50 backdrop-blur-xl">
                        <BoltIcon size={24} className="text-accent shrink-0" />
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <span className="text-sm font-semibold text-foreground">Bolt</span>
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-accent/10 text-accent text-[9px] font-bold uppercase tracking-wider">
                                <svg className="w-2.5 h-2.5" viewBox="0 0 16 16" fill="currentColor">
                                    <path d="M8 1l1.5 3.2L13 5l-2.5 2.5L11 11l-3-1.8L5 11l.5-3.5L3 5l3.5-.8z" />
                                </svg>
                                AI
                            </span>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="p-1.5 text-text-muted hover:text-text-secondary transition-colors rounded-lg hover:bg-surface-hover"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                        {messages.length === 0 && !apiError && (
                            <div className="flex flex-col items-center justify-center h-full gap-3 py-8">
                                <BoltIcon size={48} className="text-accent opacity-40" />
                                <p className="text-sm text-text-muted text-center max-w-[260px]">
                                    Ask me anything about your promos — revenue, promoters, trends, you name it.
                                </p>
                            </div>
                        )}

                        {messages.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                                <div className="flex flex-col gap-1 max-w-[85%]">
                                    {msg.role === "assistant" && (i === 0 || messages[i - 1]?.role === "user") && (
                                        <div className="flex items-center gap-1.5 ml-1 mb-0.5">
                                            <BoltIcon size={14} className="text-accent" />
                                            <span className="text-[10px] text-text-muted font-medium uppercase tracking-wider">Bolt</span>
                                        </div>
                                    )}
                                    <div
                                        className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                                            msg.role === "user"
                                                ? "bg-accent text-white rounded-br-md"
                                                : "bg-surface border border-border-light text-foreground rounded-bl-md"
                                        }`}
                                    >
                                        {msg.role === "assistant" ? formatBoltMessage(msg.content) : msg.content}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* Typing indicator */}
                        {loading && (
                            <div className="flex justify-start">
                                <div className="flex flex-col gap-1 max-w-[85%]">
                                    <div className="flex items-center gap-1.5 ml-1 mb-0.5">
                                        <BoltIcon size={14} className="text-accent" />
                                        <span className="text-[10px] text-text-muted font-medium uppercase tracking-wider">Bolt</span>
                                    </div>
                                    <div className="bg-surface border border-border-light rounded-2xl rounded-bl-md px-4 py-3 inline-flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                                        <span className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                                        <span className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="px-3 py-3 border-t border-border-light shrink-0 bg-surface/30 backdrop-blur-xl safe-area-bottom">
                        <div className="flex items-center gap-2">
                            <input
                                ref={inputRef}
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSend();
                                    }
                                }}
                                placeholder="Ask Bolt about your promos..."
                                disabled={loading}
                                className="flex-1 bg-surface border border-border-light rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/25 transition-all disabled:opacity-50"
                                autoComplete="off"
                            />
                            <button
                                onClick={handleSend}
                                disabled={loading || !input.trim()}
                                className="shrink-0 w-10 h-10 rounded-xl bg-accent text-white flex items-center justify-center hover:bg-accent/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-accent/20"
                            >
                                {loading ? (
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
