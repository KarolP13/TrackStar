import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Promo } from "./types";
import { ExportConfig } from "@/components/AnalyticsExportModal";

function formatDate(ts: { toDate: () => Date } | undefined): string {
    if (!ts || !ts.toDate) return "—";
    return ts.toDate().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

function addHeader(doc: jsPDF) {
    // TrackStar branding
    doc.setFillColor(20, 20, 20);
    doc.rect(0, 0, doc.internal.pageSize.width, 35, "F");

    // Running man emoji + name
    doc.setFontSize(16);
    doc.setTextColor(59, 130, 246);
    doc.text("TRACKSTAR", 14, 22);

    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text("Promo Tracker", 14, 29);

    // Date
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(8);
    doc.text(
        `Generated: ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`,
        doc.internal.pageSize.width - 14,
        22,
        { align: "right" }
    );
}

function addFooter(doc: jsPDF, pageNum: number) {
    const h = doc.internal.pageSize.height;
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`TrackStar Report — Page ${pageNum}`, 14, h - 10);
}

// ── Export Promo Table as PDF ──────────────────────────────

export function exportPromoTablePDF(promos: Promo[], title?: string) {
    const doc = new jsPDF();
    addHeader(doc);

    // Title
    doc.setFontSize(12);
    doc.setTextColor(30, 30, 30);
    doc.text(title || "Promo Report", 14, 45);

    const totalPromosCount = promos.reduce((sum, p) => sum + (p.isBundle && p.bundleCount ? p.bundleCount : 1), 0);

    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`${totalPromosCount} promo${totalPromosCount !== 1 ? "s" : ""} included`, 14, 51);

    // Table
    const tableData = promos.map((p) => [
        formatDate(p.promoDate),
        p.promoting,
        p.accountHandle,
        p.promoterName,
        `$${p.paymentAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
        p.paymentMethod,
        p.paymentStatus,
    ]);

    autoTable(doc, {
        startY: 56,
        head: [["Date", "Promoting", "Account", "Promoter", "Amount", "Method", "Status"]],
        body: tableData,
        theme: "grid",
        headStyles: {
            fillColor: [59, 130, 246],
            textColor: [255, 255, 255],
            fontSize: 8,
            fontStyle: "bold",
        },
        bodyStyles: {
            fontSize: 7.5,
            textColor: [50, 50, 50],
            cellPadding: 3,
        },
        alternateRowStyles: {
            fillColor: [245, 247, 250],
        },
        columnStyles: {
            4: { halign: "right" },
        },
        didDrawPage: (data) => {
            addFooter(doc, data.pageNumber);
        },
    });

    // Summary section
    const totalRevenue = promos.reduce((s, p) => s + p.paymentAmount, 0);
    const paidAmount = promos.filter((p) => p.paymentStatus === "Paid").reduce((s, p) => s + p.paymentAmount, 0);
    const pendingAmount = promos.filter((p) => p.paymentStatus === "Pending").reduce((s, p) => s + p.paymentAmount, 0);
    const overdueAmount = promos.filter((p) => p.paymentStatus === "Overdue").reduce((s, p) => s + p.paymentAmount, 0);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const finalY = (doc as any).lastAutoTable?.finalY || 200;

    doc.setFontSize(10);
    doc.setTextColor(30, 30, 30);
    doc.text("Summary", 14, finalY + 12);

    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    const summaryLines = [
        `Total Promos: ${totalPromosCount}`,
        `Total Revenue: $${totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
        `Paid: $${paidAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
        `Pending: $${pendingAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
        `Overdue: $${overdueAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
    ];
    summaryLines.forEach((line, i) => {
        doc.text(line, 14, finalY + 20 + i * 6);
    });

    const filename = `TrackStar_Report_${new Date().toISOString().split("T")[0]}.pdf`;
    doc.save(filename);
}

// ── Export Analytics Report as PDF ────────────────────────

export function exportAnalyticsPDF(promos: Promo[], countBundles: boolean, config: ExportConfig, chartImages: Record<string, string>) {
    const doc = new jsPDF();
    addHeader(doc);

    doc.setFontSize(12);
    doc.setTextColor(30, 30, 30);
    doc.text("Analytics Report", 14, 45);

    const getCount = (p: Promo) => countBundles && p.isBundle && p.bundleCount ? p.bundleCount : 1;
    const totalPromosCount = promos.reduce((sum, p) => sum + getCount(p), 0);

    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`Based on ${totalPromosCount} promo${totalPromosCount !== 1 ? "s" : ""} (${config.dateRange})`, 14, 51);

    let y = 60;

    const checkPageBreak = (neededHeight: number) => {
        if (y + neededHeight > doc.internal.pageSize.height - 20) {
            doc.addPage();
            addHeader(doc);
            y = 45;
        }
    };

    // ── Summary Stats ──
    if (config.includeSummary) {
        checkPageBreak(30);
        const totalRevenue = promos.reduce((s, p) => s + p.paymentAmount, 0);
        const avgValue = totalPromosCount > 0 ? totalRevenue / totalPromosCount : 0;

        doc.setFontSize(10);
        doc.setTextColor(30, 30, 30);
        doc.text("Overview", 14, y);
        y += 8;

        doc.setFontSize(8);
        doc.setTextColor(80, 80, 80);
        doc.text(`Total Revenue: $${totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, 14, y); y += 5;
        doc.text(`Average Promo Value: $${avgValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, 14, y); y += 5;
        doc.text(`Total Promos: ${totalPromosCount}`, 14, y); y += 10;
    }

    // ── Revenue Time Chart ──
    if (config.includeRevenueTime && chartImages.revenueTime) {
        checkPageBreak(80);
        doc.setFontSize(10);
        doc.setTextColor(30, 30, 30);
        doc.text("Revenue Over Time", 14, y);
        y += 6;
        doc.addImage(chartImages.revenueTime, "JPEG", 14, y, 180, 70);
        y += 80;
    }

    // ── Promo Volume Chart ──
    if (config.includePromoVolume && chartImages.promoVolume) {
        checkPageBreak(80);
        doc.setFontSize(10);
        doc.setTextColor(30, 30, 30);
        doc.text("Promo Volume Over Time", 14, y);
        y += 6;
        doc.addImage(chartImages.promoVolume, "JPEG", 14, y, 180, 70);
        y += 80;
    }

    // ── Payment Status ──
    if (config.includePaymentStatus) {
        checkPageBreak(40);
        doc.setFontSize(10);
        doc.setTextColor(30, 30, 30);
        doc.text("Payment Status Breakdown", 14, y);
        y += 6;

        const statusCounts: Record<string, { count: number; amount: number }> = {};
        promos.forEach((p) => {
            if (!statusCounts[p.paymentStatus]) statusCounts[p.paymentStatus] = { count: 0, amount: 0 };
            statusCounts[p.paymentStatus].count += getCount(p);
            statusCounts[p.paymentStatus].amount += p.paymentAmount;
        });

        autoTable(doc, {
            startY: y,
            head: [["Status", "Count", "Amount"]],
            body: Object.entries(statusCounts).map(([status, { count, amount }]) => [
                status,
                count.toString(),
                `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
            ]),
            theme: "grid",
            headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontSize: 8 },
            bodyStyles: { fontSize: 8, textColor: [50, 50, 50] },
            margin: { left: 14, right: 14 },
            tableWidth: 120,
            didDrawPage: (data) => { addFooter(doc, data.pageNumber); },
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        y = (doc as any).lastAutoTable?.finalY + 10 || y + 35;
    }

    // ── Revenue by Account ──
    if (config.includeRevenueAccount) {
        checkPageBreak(50);
        const accountRevenue: Record<string, number> = {};
        promos.forEach((p) => {
            accountRevenue[p.accountHandle] = (accountRevenue[p.accountHandle] || 0) + p.paymentAmount;
        });

        doc.setFontSize(10);
        doc.setTextColor(30, 30, 30);
        doc.text("Revenue by Account", 14, y);
        y += 6;

        autoTable(doc, {
            startY: y,
            head: [["Account", "Revenue", "Promos"]],
            body: Object.entries(accountRevenue)
                .sort((a, b) => b[1] - a[1])
                .map(([account, revenue]) => [
                    account,
                    `$${revenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
                    promos.filter((p) => p.accountHandle === account).reduce((sum, p) => sum + getCount(p), 0).toString(),
                ]),
            theme: "grid",
            headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontSize: 8 },
            bodyStyles: { fontSize: 8, textColor: [50, 50, 50] },
            margin: { left: 14, right: 14 },
            tableWidth: 140,
            didDrawPage: (data) => { addFooter(doc, data.pageNumber); },
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        y = (doc as any).lastAutoTable?.finalY + 10 || y + 35;
    }

    // ── Top Artists ──
    if (config.includeTopArtists) {
        checkPageBreak(50);
        const artistSpend: Record<string, number> = {};
        promos.forEach((p) => {
            artistSpend[p.promoting] = (artistSpend[p.promoting] || 0) + p.paymentAmount;
        });

        doc.setFontSize(10);
        doc.setTextColor(30, 30, 30);
        doc.text("Top Artists by Spend", 14, y);
        y += 6;

        autoTable(doc, {
            startY: y,
            head: [["Artist", "Total Spend", "Promos"]],
            body: Object.entries(artistSpend)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([artist, spend]) => [
                    artist,
                    `$${spend.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
                    promos.filter((p) => p.promoting === artist).reduce((sum, p) => sum + getCount(p), 0).toString(),
                ]),
            theme: "grid",
            headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontSize: 8 },
            bodyStyles: { fontSize: 8, textColor: [50, 50, 50] },
            margin: { left: 14, right: 14 },
            tableWidth: 140,
            didDrawPage: (data) => { addFooter(doc, data.pageNumber); },
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        y = (doc as any).lastAutoTable?.finalY + 10 || y + 35;
    }

    // ── Promoter Leaderboard ──
    if (config.includeLeaderboard) {
        checkPageBreak(60);
        const totalRev = promos.reduce((s, p) => s + p.paymentAmount, 0);
        const dataMap: Record<string, { count: number; revenue: number; impressions: number }> = {};
        promos.forEach((p) => {
            if (!dataMap[p.promoterName]) dataMap[p.promoterName] = { count: 0, revenue: 0, impressions: 0 };
            dataMap[p.promoterName].count += getCount(p);
            dataMap[p.promoterName].revenue += p.paymentAmount;
            dataMap[p.promoterName].impressions += p.impressions || 0;
        });

        doc.setFontSize(10);
        doc.setTextColor(30, 30, 30);
        doc.text("Promoter Leaderboard", 14, y);
        y += 6;

        autoTable(doc, {
            startY: y,
            head: [["Promoter", "Count", "Revenue", "Avg/Post", "% Total Rev"]],
            body: Object.entries(dataMap)
                .sort((a, b) => b[1].revenue - a[1].revenue)
                .map(([name, d]) => [
                    name,
                    d.count.toString(),
                    `$${d.revenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
                    `$${(d.count > 0 ? d.revenue / d.count : 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
                    `${(totalRev > 0 ? (d.revenue / totalRev) * 100 : 0).toFixed(1)}%`
                ]),
            theme: "grid",
            headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontSize: 8 },
            bodyStyles: { fontSize: 8, textColor: [50, 50, 50] },
            margin: { left: 14, right: 14 },
            didDrawPage: (data) => { addFooter(doc, data.pageNumber); },
        });
    }

    const filename = `TrackStar_Analytics_${new Date().toISOString().split("T")[0]}.pdf`;
    doc.save(filename);
}
