"use client";

import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Timestamp } from "firebase/firestore";
import { Promo } from "@/lib/types";

interface ImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (promos: Omit<Promo, "id">[]) => Promise<void>;
    userId: string;
}

interface ParsedRow {
    promoting: string;
    promoterName: string;
    accountHandle: string;
    promoDate: string;
    paymentMethod: string;
    paymentAmount: number;
    paymentStatus: string;
    tweetLink: string;
    notes: string;
    isBundle: boolean;
    bundleCount: number | null;
}

const EXPECTED_COLUMNS = [
    "promoting",
    "promoterName",
    "accountHandle",
    "promoDate",
    "paymentMethod",
    "paymentAmount",
    "paymentStatus",
    "tweetLink",
    "notes",
];

// Fuzzy column matching — maps common header names to our fields
const COLUMN_ALIASES: Record<string, string> = {
    // promoting
    "promoting": "promoting",
    "artist": "promoting",
    "artist name": "promoting",
    "song": "promoting",
    "track": "promoting",
    "what": "promoting",
    // promoterName
    "promotername": "promoterName",
    "promoter name": "promoterName",
    "promoter": "promoterName",
    "page": "promoterName",
    "page name": "promoterName",
    "who": "promoterName",
    "name": "promoterName",
    "contact": "promoterName",
    "to email address": "promoterName",
    // accountHandle
    "accounthandle": "accountHandle",
    "account handle": "accountHandle",
    "account": "accountHandle",
    "handle": "accountHandle",
    "@": "accountHandle",
    // promoDate
    "promodate": "promoDate",
    "promo date": "promoDate",
    "date": "promoDate",
    // paymentMethod
    "paymentmethod": "paymentMethod",
    "payment method": "paymentMethod",
    "method": "paymentMethod",
    "payment type": "paymentMethod",
    // paymentAmount
    "paymentamount": "paymentAmount",
    "payment amount": "paymentAmount",
    "amount": "paymentAmount",
    "price": "paymentAmount",
    "cost": "paymentAmount",
    "rate": "paymentAmount",
    "$": "paymentAmount",
    "gross": "paymentAmount",
    "net": "paymentAmount",
    // paymentStatus
    "paymentstatus": "paymentStatus",
    "payment status": "paymentStatus",
    "status": "paymentStatus",
    // tweetLink
    "tweetlink": "tweetLink",
    "tweet link": "tweetLink",
    "link": "tweetLink",
    "url": "tweetLink",
    "proof": "tweetLink",
    // notes
    "notes": "notes",
    "note": "notes",
    "comments": "notes",
    "comment": "notes",
};

function normalizeHeader(h: string): string {
    return h.trim().toLowerCase().replace(/[_\-]/g, " ");
}

function parseDate(value: unknown): Date | null {
    if (!value) return null;
    // Excel serial date number
    if (typeof value === "number") {
        const d = XLSX.SSF.parse_date_code(value);
        if (d) return new Date(d.y, d.m - 1, d.d);
    }
    const str = String(value).trim();
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
}

function parseAmount(value: unknown): number {
    if (typeof value === "number") return Math.abs(value);
    const str = String(value).replace(/[$,\s]/g, "");
    const n = parseFloat(str);
    return isNaN(n) ? 0 : Math.abs(n);
}

function parseStatus(value: unknown): "Pending" | "Paid" | "Overdue" {
    const s = String(value || "").trim().toLowerCase();
    if (s === "paid" || s === "completed") return "Paid";
    if (s === "overdue") return "Overdue";
    return "Pending";
}

export default function ImportModal({ isOpen, onClose, onImport, userId }: ImportModalProps) {
    const fileRef = useRef<HTMLInputElement>(null);
    const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
    const [columnMap, setColumnMap] = useState<Record<string, string>>({});
    const [rawHeaders, setRawHeaders] = useState<string[]>([]);
    const [fileName, setFileName] = useState("");
    const [step, setStep] = useState<"upload" | "preview" | "importing">("upload");
    const [error, setError] = useState("");
    const [importCount, setImportCount] = useState(0);

    const reset = () => {
        setParsedRows([]);
        setColumnMap({});
        setRawHeaders([]);
        setFileName("");
        setStep("upload");
        setError("");
        setImportCount(0);
        if (fileRef.current) fileRef.current.value = "";
    };

    const handleClose = () => {
        reset();
        onClose();
    };

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setError("");
        setFileName(file.name);

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = new Uint8Array(evt.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: "array" });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

                if (json.length === 0) {
                    setError("The spreadsheet appears to be empty.");
                    return;
                }

                // Auto-map columns
                const headers = Object.keys(json[0]);
                setRawHeaders(headers);
                const map: Record<string, string> = {};
                headers.forEach((h) => {
                    const normalized = normalizeHeader(h);
                    const match = COLUMN_ALIASES[normalized];
                    if (match) map[h] = match;
                });
                setColumnMap(map);

                // Parse rows using the mapped columns
                const rows = parseRows(json, map);
                setParsedRows(rows);
                setStep("preview");
            } catch {
                setError("Failed to read the file. Make sure it's a valid .xlsx, .xls, or .csv file.");
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const parseRows = (json: Record<string, unknown>[], map: Record<string, string>): ParsedRow[] => {
        // Invert map: field -> header
        const fieldToHeader: Record<string, string> = {};
        Object.entries(map).forEach(([header, field]) => {
            fieldToHeader[field] = header;
        });

        return json.map((row) => {
            const get = (field: string) => row[fieldToHeader[field]] ?? "";
            return {
                promoting: String(get("promoting")).trim(),
                promoterName: String(get("promoterName")).trim(),
                accountHandle: String(get("accountHandle")).trim(),
                promoDate: (() => {
                    const d = parseDate(get("promoDate"));
                    return d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
                })(),
                paymentMethod: String(get("paymentMethod")).trim(),
                paymentAmount: parseAmount(get("paymentAmount")),
                paymentStatus: parseStatus(get("paymentStatus")),
                tweetLink: String(get("tweetLink")).trim(),
                notes: String(get("notes")).trim(),
                isBundle: false,
                bundleCount: null,
            };
        }).filter((r) => r.promoting || r.promoterName || r.paymentAmount > 0);
    };

    const handleColumnChange = (header: string, field: string) => {
        const newMap = { ...columnMap };
        if (field === "") {
            delete newMap[header];
        } else {
            // Remove any existing mapping to this field
            Object.keys(newMap).forEach((k) => {
                if (newMap[k] === field) delete newMap[k];
            });
            newMap[header] = field;
        }
        setColumnMap(newMap);
    };

    const handleReparse = () => {
        // Re-read the file and parse with updated column map
        const file = fileRef.current?.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const data = new Uint8Array(evt.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: "array" });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
            const rows = parseRows(json, columnMap);
            setParsedRows(rows);
        };
        reader.readAsArrayBuffer(file);
    };

    const handleImport = async () => {
        setStep("importing");
        setError("");
        try {
            const promos: Omit<Promo, "id">[] = parsedRows.map((row) => ({
                userId,
                promoting: row.promoting || "Unknown",
                promoterName: row.promoterName || "Unknown",
                accountHandle: row.accountHandle || "",
                promoDate: Timestamp.fromDate(
                    parseDate(row.promoDate) || new Date()
                ),
                paymentMethod: row.paymentMethod || "PayPal",
                paymentAmount: row.paymentAmount,
                paymentStatus: parseStatus(row.paymentStatus),
                tweetLink: row.tweetLink || undefined,
                notes: row.notes || undefined,
                createdAt: Timestamp.now(),
                isBundle: false,
            }));
            await onImport(promos);
            setImportCount(promos.length);
            setTimeout(() => handleClose(), 2000);
        } catch {
            setError("Failed to import promos. Please try again.");
            setStep("preview");
        }
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-fade-in" onClick={handleClose} />

            {/* Modal */}
            <div className="fixed inset-0 z-50 pointer-events-none">
                <div className="pointer-events-auto fixed inset-0 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 w-full md:w-[680px] md:max-h-[85vh] h-[100dvh] md:h-auto md:rounded-2xl bg-background md:border border-border-light shadow-2xl flex flex-col overflow-hidden animate-slide-in">

                    {/* Header */}
                    <div className="relative flex items-center justify-center px-5 sm:px-6 py-5 sm:py-6 border-b border-border-light">
                        <h2 className="text-lg font-semibold text-foreground">Import from Excel</h2>
                        <button onClick={handleClose} className="absolute right-5 sm:right-6 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors p-1">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
                        {step === "upload" && (
                            <div className="space-y-4">
                                <p className="text-sm text-text-secondary">
                                    Upload an Excel (.xlsx, .xls) or CSV file (including PayPal Activity CSVs) with your promo data. We&apos;ll auto-detect the columns.
                                </p>
                                <div
                                    className="border-2 border-dashed border-border-light rounded-xl p-10 text-center cursor-pointer hover:border-accent/40 hover:bg-accent/5 transition-all"
                                    onClick={() => fileRef.current?.click()}
                                >
                                    <svg className="w-10 h-10 mx-auto text-text-muted mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                                    </svg>
                                    <p className="text-sm text-foreground font-medium">Click to upload or drag & drop</p>
                                    <p className="text-xs text-text-muted mt-1">.xlsx, .xls, or .csv</p>
                                </div>
                                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
                                {error && <p className="text-sm text-red-400">{error}</p>}

                                <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-4">
                                    <p className="text-xs text-text-muted font-medium mb-2">Expected columns (we&apos;ll try to match automatically):</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {["Artist/Promoting", "Promoter", "Account", "Date", "Amount", "Method", "Status", "Link", "Notes"].map((c) => (
                                            <span key={c} className="px-2 py-1 rounded-md bg-white/[0.06] text-xs text-text-secondary">{c}</span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {step === "preview" && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-foreground font-medium">{fileName}</p>
                                        <p className="text-xs text-text-muted">{parsedRows.length} row{parsedRows.length !== 1 ? "s" : ""} detected</p>
                                    </div>
                                    <button onClick={() => { reset(); }} className="text-xs text-accent hover:text-accent/80 transition-colors">Choose different file</button>
                                </div>

                                {/* Column mapping */}
                                <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs text-text-muted font-medium uppercase tracking-wider">Column Mapping</p>
                                        <button onClick={handleReparse} className="text-[11px] text-accent hover:text-accent/80 transition-colors">Refresh preview</button>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {rawHeaders.map((header) => (
                                            <div key={header} className="flex items-center gap-2">
                                                <span className="text-xs text-text-secondary truncate w-28 flex-shrink-0" title={header}>{header}</span>
                                                <span className="text-text-muted text-xs">→</span>
                                                <select
                                                    value={columnMap[header] || ""}
                                                    onChange={(e) => handleColumnChange(header, e.target.value)}
                                                    className="flex-1 bg-white/[0.06] border border-white/[0.08] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-accent/50 appearance-none cursor-pointer"
                                                >
                                                    <option value="">— Skip —</option>
                                                    {EXPECTED_COLUMNS.map((col) => (
                                                        <option key={col} value={col}>{col}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Data preview */}
                                <div className="overflow-x-auto border border-white/[0.06] rounded-lg">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="border-b border-border-light bg-white/[0.02]">
                                                <th className="text-left px-3 py-2 text-text-muted font-medium">Artist</th>
                                                <th className="text-left px-3 py-2 text-text-muted font-medium">Promoter</th>
                                                <th className="text-left px-3 py-2 text-text-muted font-medium">Account</th>
                                                <th className="text-left px-3 py-2 text-text-muted font-medium">Date</th>
                                                <th className="text-right px-3 py-2 text-text-muted font-medium">Amount</th>
                                                <th className="text-left px-3 py-2 text-text-muted font-medium">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {parsedRows.slice(0, 10).map((row, i) => (
                                                <tr key={i} className="border-b border-white/[0.04]">
                                                    <td className="px-3 py-2 text-text-secondary">{row.promoting || <span className="text-text-muted opacity-50">—</span>}</td>
                                                    <td className="px-3 py-2 text-text-secondary">{row.promoterName || <span className="text-text-muted opacity-50">—</span>}</td>
                                                    <td className="px-3 py-2 text-accent font-mono">{row.accountHandle || <span className="text-text-muted opacity-50">—</span>}</td>
                                                    <td className="px-3 py-2 text-text-secondary">{row.promoDate || <span className="text-text-muted opacity-50">—</span>}</td>
                                                    <td className="px-3 py-2 text-right text-foreground font-medium">${row.paymentAmount.toFixed(2)}</td>
                                                    <td className="px-3 py-2 text-text-secondary">{row.paymentStatus}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {parsedRows.length > 10 && (
                                        <p className="text-center text-[11px] text-text-muted py-2">…and {parsedRows.length - 10} more rows</p>
                                    )}
                                </div>

                                {error && <p className="text-sm text-red-400">{error}</p>}
                            </div>
                        )}

                        {step === "importing" && (
                            <div className="flex flex-col items-center justify-center py-12">
                                {importCount > 0 ? (
                                    <>
                                        <svg className="w-12 h-12 text-green-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <p className="text-foreground font-medium">{importCount} promos imported!</p>
                                    </>
                                ) : (
                                    <>
                                        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mb-4" />
                                        <p className="text-text-muted text-sm">Importing {parsedRows.length} promos...</p>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    {step === "preview" && (
                        <div className="px-5 sm:px-6 py-4 border-t border-border-light flex items-center justify-between">
                            <button onClick={handleClose} className="px-4 py-2 rounded-lg text-sm text-text-muted hover:text-foreground transition-colors">Cancel</button>
                            <button
                                onClick={handleImport}
                                disabled={parsedRows.length === 0}
                                className="px-5 py-2.5 rounded-lg bg-accent hover:bg-accent/90 text-white text-sm font-medium transition-all shadow-lg shadow-accent/20 disabled:opacity-50"
                            >
                                Import {parsedRows.length} Promo{parsedRows.length !== 1 ? "s" : ""}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
