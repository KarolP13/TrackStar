"use client";

import { useState, useRef, useMemo } from "react";
import Papa from "papaparse";
import { Timestamp, writeBatch, doc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Promo } from "@/lib/types";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface ImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
    // We fetch current defaults for empty fields
    defaults?: { paymentMethod: string; accountHandle: string; promoterName: string };
    onComplete: () => void;
}

// ── Types ────────────────────────────────────────────────────────

type WizardStep = "upload" | "mapping" | "preview" | "importing" | "summary";

export interface MappedRow {
    promoting: string;
    promoterName: string;
    accountHandle: string;
    promoDate: string; // MM/DD/YYYY string roughly
    paymentMethod: string;
    paymentAmount: number;
    paymentStatus: "Pending" | "Paid" | "Overdue";
    tweetLink: string;
    notes: string;
}

interface ValidationResult {
    isValid: boolean;
    errors: string[];
    row: MappedRow;
}

// ── Field Options ──────────────────────────────────────────────

const TRACKSTAR_FIELDS = [
    { key: "promoting", label: "Artist (Promoting)", required: true },
    { key: "promoterName", label: "Promoter Name", required: false },
    { key: "accountHandle", label: "Account Handle", required: false },
    { key: "promoDate", label: "Date", required: true },
    { key: "paymentAmount", label: "Amount ($)", required: false },
    { key: "paymentMethod", label: "Payment Method", required: false },
    { key: "paymentStatus", label: "Status (Paid/Pending)", required: false },
    { key: "tweetLink", label: "Post Link", required: false },
    { key: "notes", label: "Notes", required: false },
];

const IGNORE_FIELD = "IGNORE_FIELD";

// ── Helper: Fuzzy Matcher ──────────────────────────────────────

function fuzzyMatchHeading(header: string): string {
    const norm = header.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (norm.includes("artist") || norm.includes("song") || norm === "promoting" || norm === "client") return "promoting";
    if (norm.includes("promoter") || norm.includes("page") || norm === "name" || norm === "who") return "promoterName";
    if (norm.includes("handle") || norm === "account" || norm === "at") return "accountHandle";
    if (norm.includes("date") || norm === "when") return "promoDate";
    if (norm.includes("amount") || norm.includes("price") || norm.includes("cost") || norm.includes("paid")) return "paymentAmount";
    if (norm.includes("method") || norm.includes("type") || norm.includes("via")) return "paymentMethod";
    if (norm.includes("status") || norm.includes("state")) return "paymentStatus";
    if (norm.includes("link") || norm.includes("url") || norm.includes("tweet") || norm.includes("post")) return "tweetLink";
    if (norm.includes("note") || norm.includes("comment")) return "notes";
    return IGNORE_FIELD;
}

// ── Components ──────────────────────────────────────────────────

export default function ImportModal({ isOpen, onClose, userId, defaults, onComplete }: ImportModalProps) {
    const fileRef = useRef<HTMLInputElement>(null);
    const [step, setStep] = useState<WizardStep>("upload");
    const [isDragging, setIsDragging] = useState(false);

    const [fileName, setFileName] = useState("");
    const [rawHeaders, setRawHeaders] = useState<string[]>([]);
    const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);

    // Ordered columns for mapping step
    const [orderedColumns, setOrderedColumns] = useState<string[]>([]);
    // Mapping from Header -> TrackStar key
    const [columnMap, setColumnMap] = useState<Record<string, string>>({});

    // Previews & Import State
    const [validatedRows, setValidatedRows] = useState<ValidationResult[]>([]);
    const [importStats, setImportStats] = useState({ success: 0, failed: 0, total: 0 });
    const [isImporting, setIsImporting] = useState(false);
    const [importProgress, setImportProgress] = useState(0);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Initial reset
    if (!isOpen) return null;

    const reset = () => {
        setStep("upload");
        setFileName("");
        setRawHeaders([]);
        setRawRows([]);
        setOrderedColumns([]);
        setColumnMap({});
        setValidatedRows([]);
        setImportStats({ success: 0, failed: 0, total: 0 });
        setIsImporting(false);
        setImportProgress(0);
        if (fileRef.current) fileRef.current.value = "";
    };

    const handleClose = () => {
        if (isImporting) return;
        reset();
        onClose();
    };

    // ── STEP 1: Upload (PapaParse) ──

    const processFile = (file: File) => {
        if (!file.name.toLowerCase().endsWith(".csv")) {
            alert("Please upload a .csv file.");
            return;
        }
        setFileName(file.name);

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                if (!results.meta.fields || results.meta.fields.length === 0) {
                    alert("No columns found in CSV.");
                    return;
                }
                const headers = results.meta.fields;
                setRawHeaders(headers);
                setOrderedColumns(headers);
                setRawRows(results.data as Record<string, string>[]);

                // Auto map
                const initialMap: Record<string, string> = {};
                const takenFields = new Set<string>();

                headers.forEach(h => {
                    const guess = fuzzyMatchHeading(h);
                    if (guess !== IGNORE_FIELD && !takenFields.has(guess)) {
                        initialMap[h] = guess;
                        takenFields.add(guess);
                    } else {
                        initialMap[h] = IGNORE_FIELD;
                    }
                });

                setColumnMap(initialMap);
                setStep("mapping");
            },
            error: (err) => {
                alert(`Error parsing file: ${err.message}`);
            }
        });
    };

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            processFile(e.target.files[0]);
        }
    };

    // ── STEP 2: Mapping ──

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        setOrderedColumns((items) => {
            const oldIndex = items.indexOf(active.id as string);
            const newIndex = items.indexOf(over.id as string);
            return arrayMove(items, oldIndex, newIndex);
        });
    };

    const handleMapChange = (header: string, targetField: string) => {
        setColumnMap(prev => {
            const next = { ...prev };
            // Ensure 1:1 mapping (unless ignoring)
            if (targetField !== IGNORE_FIELD) {
                Object.keys(next).forEach(k => {
                    if (next[k] === targetField) next[k] = IGNORE_FIELD;
                });
            }
            next[header] = targetField;
            return next;
        });
    };

    const generatePreview = () => {
        // Validate requirements
        const mappedFields = new Set(Object.values(columnMap));
        const missingReqs = TRACKSTAR_FIELDS.filter(f => f.required && !mappedFields.has(f.key));
        if (missingReqs.length > 0) {
            alert(`Missing required mappings: ${missingReqs.map(r => r.label).join(", ")}`);
            return;
        }

        const validRes: ValidationResult[] = rawRows.map(row => {
            const finalRow: any = {};
            const errors: string[] = [];

            // Extract based on mapping
            Object.entries(columnMap).forEach(([header, fieldKey]) => {
                if (fieldKey !== IGNORE_FIELD) {
                    finalRow[fieldKey] = row[header] || "";
                }
            });

            // 1. Artist (Required)
            const artist = (finalRow.promoting || "").trim();
            if (!artist) errors.push("Missing Artist name.");

            // 2. Date (Required & Format)
            let parsedDate = finalRow.promoDate || "";
            const dStr = String(parsedDate).trim();
            const d = new Date(dStr);
            if (!dStr || isNaN(d.getTime())) {
                errors.push(`Invalid date format: "${dStr}"`);
                parsedDate = ""; // blank it if totally invalid
            } else {
                parsedDate = d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
            }

            // 3. Amount
            const amtRaw = String(finalRow.paymentAmount || "0").replace(/[^0-9.]/g, "");
            const parsedAmt = parseFloat(amtRaw);
            if (isNaN(parsedAmt)) errors.push("Invalid payment amount format.");

            // 4. Status
            let pStatus = "Pending";
            const sRaw = String(finalRow.paymentStatus || "").toLowerCase();
            if (sRaw === "paid" || sRaw === "completed") pStatus = "Paid";
            else if (sRaw === "overdue") pStatus = "Overdue";

            const cleanedRow: MappedRow = {
                promoting: artist,
                promoterName: (finalRow.promoterName || "").trim(),
                accountHandle: (finalRow.accountHandle || "").trim(),
                promoDate: parsedDate,
                paymentAmount: isNaN(parsedAmt) ? 0 : parsedAmt,
                paymentMethod: (finalRow.paymentMethod || "").trim(),
                paymentStatus: pStatus as any,
                tweetLink: (finalRow.tweetLink || "").trim(),
                notes: (finalRow.notes || "").trim(),
            };

            return {
                isValid: errors.length === 0,
                errors,
                row: cleanedRow
            };
        });

        setValidatedRows(validRes);
        setStep("preview");
    };

    // ── STEP 3: Preview & Import ──

    const executeImport = async () => {
        setIsImporting(true);
        setStep("importing");

        const validDocs = validatedRows.filter(r => r.isValid).map(r => r.row);
        setImportStats({ success: 0, failed: validatedRows.length - validDocs.length, total: validatedRows.length });

        const CHUNK_SIZE = 500; // Firestore batch limit
        const chunks = [];
        for (let i = 0; i < validDocs.length; i += CHUNK_SIZE) {
            chunks.push(validDocs.slice(i, i + CHUNK_SIZE));
        }

        let currentSuccess = 0;
        const promosRef = collection(db, `users/${userId}/promos`);

        for (let i = 0; i < chunks.length; i++) {
            const batch = writeBatch(db);

            chunks[i].forEach(row => {
                const docRef = doc(promosRef);
                const d = new Date(row.promoDate);

                const promoData: Omit<Promo, "id"> = {
                    userId,
                    promoting: row.promoting,
                    promoterName: row.promoterName || defaults?.promoterName || "Unknown",
                    accountHandle: row.accountHandle || defaults?.accountHandle || "@unknown",
                    promoDate: Timestamp.fromDate(d),
                    paymentAmount: row.paymentAmount,
                    paymentMethod: row.paymentMethod || defaults?.paymentMethod || "PayPal",
                    paymentStatus: row.paymentStatus,
                    tweetLink: row.tweetLink,
                    notes: row.notes,
                    createdAt: Timestamp.now(),
                    isBundle: false,
                    isRecurring: false,
                };

                batch.set(docRef, promoData);
            });

            await batch.commit();
            currentSuccess += chunks[i].length;
            setImportProgress(Math.round((currentSuccess / validDocs.length) * 100));
        }

        setImportStats(prev => ({ ...prev, success: currentSuccess }));
        setIsImporting(false);
        setStep("summary");
        onComplete();
    };

    // ── Render Helpers ──

    const getPreviewValues = (header: string) => {
        return rawRows.slice(0, 3).map(r => r[header] || "—");
    };

    return (
        <>
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-fade-in" onClick={handleClose} />
            <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center p-4 sm:p-6">
                <div className="pointer-events-auto w-full max-w-5xl max-h-[90vh] bg-background border border-border-light rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-in">

                    <div className="px-6 py-5 border-b border-border-light flex justify-between items-center shrink-0">
                        <div>
                            <h2 className="text-xl font-bold text-foreground">Import CSV</h2>
                            <p className="text-xs text-text-muted mt-1">Bulk create promos from a spreadsheet.</p>
                        </div>
                        {!isImporting && (
                            <button onClick={handleClose} className="p-2 text-text-muted hover:text-text-secondary transition-colors rounded-lg hover:bg-surface">
                                ✕
                            </button>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-0 relative">
                        {step === "upload" && (
                            <div className="p-8 sm:p-12 h-full flex flex-col items-center justify-center">
                                <div
                                    className={`w-full max-w-lg aspect-video rounded-xl border-2 border-dashed flex flex-col items-center justify-center p-8 transition-colors ${isDragging ? "border-accent bg-accent/5" : "border-border-light bg-surface hover:border-text-muted"}`}
                                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                    onDragLeave={() => setIsDragging(false)}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        setIsDragging(false);
                                        const file = e.dataTransfer.files?.[0];
                                        if (file) processFile(file);
                                    }}
                                >
                                    <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-4 text-accent">
                                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                        </svg>
                                    </div>
                                    <h3 className="text-base font-bold text-foreground mb-1">Drag and drop your .csv file here</h3>
                                    <p className="text-sm text-text-muted text-center max-w-xs mb-6">Must be a comma-separated values file with headers in the first row.</p>

                                    <input type="file" ref={fileRef} accept=".csv" className="hidden" onChange={onFileChange} />
                                    <button onClick={() => fileRef.current?.click()} className="px-5 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-sm font-medium text-foreground transition-colors border border-border-light">
                                        Browse Files
                                    </button>
                                </div>
                            </div>
                        )}

                        {step === "mapping" && (
                            <div className="p-6">
                                <div className="bg-surface rounded-xl border border-border-light overflow-hidden mb-6">
                                    <div className="px-5 py-4 border-b border-border-light flex justify-between items-center bg-background/50">
                                        <div>
                                            <h3 className="font-semibold text-foreground">Map Columns</h3>
                                            <p className="text-xs text-text-muted">Align your spreadsheet headers (left) with TrackStar fields (right).</p>
                                        </div>
                                    </div>
                                    <div className="p-0">
                                        <div className="grid grid-cols-[minmax(150px,2fr)_minmax(150px,2fr)_minmax(200px,3fr)] gap-4 px-5 py-3 border-b border-border-light bg-white/[0.02] text-xs font-semibold uppercase tracking-wider text-text-muted">
                                            <div>Your Header</div>
                                            <div>TrackStar Field</div>
                                            <div className="hidden sm:block">Sample Data</div>
                                        </div>
                                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                            <SortableContext items={orderedColumns} strategy={verticalListSortingStrategy}>
                                                <ul className="divide-y divide-border-light/50">
                                                    {orderedColumns.map((header) => (
                                                        <SortableMappingRow
                                                            key={header}
                                                            id={header}
                                                            header={header}
                                                            mappedField={columnMap[header]}
                                                            sampleData={getPreviewValues(header)}
                                                            onMapChange={(target) => handleMapChange(header, target)}
                                                        />
                                                    ))}
                                                </ul>
                                            </SortableContext>
                                        </DndContext>
                                    </div>
                                </div>
                            </div>
                        )}

                        {step === "preview" && (
                            <div className="p-6 flex flex-col h-full">
                                <div className="flex gap-4 mb-4">
                                    <div className="bg-surface border border-border-light rounded-lg px-4 py-3 flex-1 flex items-center justify-between">
                                        <div>
                                            <p className="text-xs text-text-muted font-medium mb-0.5">Valid Promos</p>
                                            <p className="text-xl font-bold text-green-400">{validatedRows.filter(r => r.isValid).length}</p>
                                        </div>
                                        <div className="w-10 h-10 rounded-full bg-green-400/10 flex items-center justify-center text-green-400">
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                        </div>
                                    </div>
                                    <div className="bg-surface border border-border-light rounded-lg px-4 py-3 flex-1 flex items-center justify-between">
                                        <div>
                                            <p className="text-xs text-text-muted font-medium mb-0.5">Rows with Errors (Will Skip)</p>
                                            <p className="text-xl font-bold text-red-400">{validatedRows.filter(r => !r.isValid).length}</p>
                                        </div>
                                        <div className="w-10 h-10 rounded-full bg-red-400/10 flex items-center justify-center text-red-400">
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-hidden border border-border-light rounded-xl flex flex-col bg-surface min-h-[400px]">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse whitespace-nowrap min-w-[800px]">
                                            <thead>
                                                <tr className="bg-background/80 border-b border-border-light text-xs font-semibold text-text-muted uppercase tracking-wider backdrop-blur-sm sticky top-0 z-10">
                                                    <th className="px-4 py-3 w-10"></th>
                                                    <th className="px-4 py-3">Artist</th>
                                                    <th className="px-4 py-3">Promoter</th>
                                                    <th className="px-4 py-3">Date</th>
                                                    <th className="px-4 py-3 text-right">Amount</th>
                                                    <th className="px-4 py-3">Status</th>
                                                    <th className="px-4 py-3">Error Context</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border-light/50">
                                                {validatedRows.map((v, i) => (
                                                    <tr key={i} className={`hover:bg-white/[0.02] transition-colors ${!v.isValid ? "bg-red-500/5 hover:bg-red-500/10" : ""}`}>
                                                        <td className="px-4 py-3 text-xs text-text-muted">
                                                            {v.isValid ? (
                                                                <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                                            ) : (
                                                                <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 text-sm font-medium text-foreground">{v.row.promoting || "—"}</td>
                                                        <td className="px-4 py-3 text-sm text-text-secondary">{v.row.promoterName || "—"}</td>
                                                        <td className="px-4 py-3 text-sm text-text-secondary">{v.row.promoDate || "—"}</td>
                                                        <td className="px-4 py-3 text-sm text-accent text-right font-medium">${v.row.paymentAmount.toFixed(2)}</td>
                                                        <td className="px-4 py-3 text-xs">
                                                            <span className={`px-2 py-0.5 rounded-full font-medium ${v.row.paymentStatus === "Paid" ? "bg-green-500/10 text-green-400" : v.row.paymentStatus === "Overdue" ? "bg-red-500/10 text-red-400" : "bg-yellow-500/10 text-yellow-500"}`}>{v.row.paymentStatus}</span>
                                                        </td>
                                                        <td className="px-4 py-3 text-xs text-red-300 font-medium">
                                                            {!v.isValid && Array.from(new Set(v.errors)).join(" • ")}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {(step === "importing" || step === "summary") && (
                            <div className="p-12 flex flex-col items-center justify-center min-h-[400px]">
                                {step === "importing" ? (
                                    <div className="text-center">
                                        <div className="w-16 h-16 border-4 border-border-light border-t-accent rounded-full animate-spin mx-auto mb-6"></div>
                                        <h3 className="text-xl font-bold text-foreground mb-2">Importing Data...</h3>
                                        <p className="text-sm text-text-muted mb-6">Writing batches to Firestore.</p>
                                        <div className="w-64 h-2 bg-surface border border-border-light rounded-full overflow-hidden">
                                            <div className="h-full bg-accent transition-all duration-300 ease-out" style={{ width: `${importProgress}%` }}></div>
                                        </div>
                                        <p className="text-xs text-text-muted mt-2">{importProgress}% Complete</p>
                                    </div>
                                ) : (
                                    <div className="text-center">
                                        <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6 text-green-400 shadow-lg shadow-green-500/20">
                                            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                        </div>
                                        <h3 className="text-2xl font-bold text-foreground mb-2">Import Complete</h3>
                                        <p className="text-text-muted mb-8">Successfully created {importStats.success} promos.</p>

                                        {importStats.failed > 0 && (
                                            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-8 inline-block text-left">
                                                <p className="text-sm font-medium text-red-400">⚠️ {importStats.failed} rows were skipped due to formatting errors.</p>
                                            </div>
                                        )}

                                        <button onClick={handleClose} className="px-6 py-2.5 rounded-lg bg-accent text-white font-medium hover:bg-accent-light transition-colors shadow-lg shadow-accent/20">
                                            Return to Dashboard
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Step Navigation Footer */}
                    {step !== "upload" && step !== "summary" && step !== "importing" && (
                        <div className="px-6 py-4 border-t border-border-light bg-background/50 flex justify-between items-center shrink-0">
                            <div>
                                {step === "preview" && (
                                    <button onClick={() => setStep("mapping")} className="text-sm text-text-muted hover:text-foreground transition-colors font-medium">← Back to Mapping</button>
                                )}
                            </div>
                            <div className="flex gap-3">
                                <button onClick={handleClose} className="px-4 py-2 rounded-lg text-sm text-text-muted hover:text-foreground transition-colors">Cancel</button>
                                {step === "mapping" && (
                                    <button onClick={generatePreview} className="px-6 py-2 rounded-lg bg-accent text-white hover:bg-accent-light font-medium transition-colors shadow-lg shadow-accent/20 text-sm flex items-center gap-2">
                                        Review Data →
                                    </button>
                                )}
                                {step === "preview" && (
                                    <button
                                        onClick={executeImport}
                                        disabled={validatedRows.filter(r => r.isValid).length === 0}
                                        className="px-6 py-2 rounded-lg bg-green-500 text-white hover:bg-green-400 font-medium transition-colors shadow-lg shadow-green-500/20 text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Import {validatedRows.filter(r => r.isValid).length} Promos
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

// ── Mapping Row Component ──

interface SortableMappingRowProps {
    id: string;
    header: string;
    mappedField: string;
    sampleData: string[];
    onMapChange: (target: string) => void;
}

function SortableMappingRow({ id, header, mappedField, sampleData, onMapChange }: SortableMappingRowProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

    return (
        <li
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform), transition }}
            className={`grid grid-cols-1 sm:grid-cols-[minmax(150px,2fr)_minmax(150px,2fr)_minmax(200px,3fr)] gap-4 px-5 py-4 items-center bg-surface relative z-0 ${isDragging ? "z-10 shadow-lg ring-1 ring-border-light opacity-80" : "hover:bg-white/[0.01]"}`}
        >
            <div className="flex items-center gap-3 overflow-hidden">
                <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1.5 -ml-1.5 text-text-muted hover:text-foreground hover:bg-white/5 rounded">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" /></svg>
                </div>
                <div className="px-2 py-1 bg-white/[0.03] border border-border-light rounded text-sm font-medium text-foreground truncate w-full" title={header}>
                    {header}
                </div>
            </div>

            <div className="flex items-center relative">
                <select
                    value={mappedField}
                    onChange={(e) => onMapChange(e.target.value)}
                    className={`w-full appearance-none bg-surface border rounded-lg px-3 py-1.5 text-sm transition-colors pr-8 focus:outline-none focus:ring-1 ${mappedField !== IGNORE_FIELD ? "border-accent/40 text-accent font-medium focus:border-accent focus:ring-accent" : "border-border-light text-text-secondary focus:border-text-muted focus:ring-text-muted"}`}
                >
                    <option value={IGNORE_FIELD} className="text-text-muted">Ignore Column</option>
                    <optgroup label="TrackStar Fields" className="text-foreground">
                        {TRACKSTAR_FIELDS.map(f => (
                            <option key={f.key} value={f.key}>{f.label} {f.required ? "*" : ""}</option>
                        ))}
                    </optgroup>
                </select>
                <svg className="absolute right-3 w-4 h-4 pointer-events-none text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </div>

            <div className="hidden sm:flex gap-2 overflow-x-auto no-scrollbar mask-edges">
                {sampleData.map((d, i) => (
                    <div key={i} className="px-2 py-1 text-[11px] bg-background border border-border-light rounded shrink-0 max-w-[150px] truncate text-text-secondary" title={d}>
                        {d}
                    </div>
                ))}
            </div>
        </li>
    );
}
