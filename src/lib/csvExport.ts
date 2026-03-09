import { Promo } from "./types";

function formatDate(ts: { toDate: () => Date } | undefined): string {
    if (!ts || !ts.toDate) return "—";
    return ts.toDate().toISOString().split("T")[0]; // YYYY-MM-DD format for Excel
}

function escapeCsvField(field: string | number | undefined | null): string {
    if (field === null || field === undefined) return "";
    const str = String(field);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

export function exportPromosToCSV(promos: Promo[]) {
    // Define headers
    const headers = [
        "Date",
        "Promoting",
        "Account",
        "Promoter",
        "Amount ($)",
        "Method",
        "Status",
        "Type",
        "Quantity",
        "Notes",
    ];

    // Build rows
    const rows = promos.map((p) => {
        let type = "One-time";
        if (p.isBundle) type = "Bundle";
        else if (p.isRecurring) type = "Recurring";

        let quantity = 1;
        if (p.isBundle && p.bundleCount) quantity = p.bundleCount;

        return [
            formatDate(p.promoDate),
            p.promoting,
            p.accountHandle,
            p.promoterName,
            p.paymentAmount.toString(),
            p.paymentMethod,
            p.paymentStatus,
            type,
            quantity.toString(),
            p.notes || "",
        ];
    });

    // Combine headers and rows
    const csvContent = [
        headers.map(escapeCsvField).join(","),
        ...rows.map((row) => row.map(escapeCsvField).join(",")),
    ].join("\n");

    // Create blob and download link
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `TrackStar_Data_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
