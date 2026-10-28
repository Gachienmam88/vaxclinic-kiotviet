"use client";

import { useState } from "react";
import { downloadCsv } from "@/features/accounting/tax-calc";
import { ymd } from "@/features/dashboard/dashboard-date-utils";
import { FILTER_FIELD, FilterSection, RadioOption } from "@/features/sales/invoice-list-kit";
import { useReport, type MonthRow } from "./report-api";
import { BranchFilter, ReportLayout, SelectFilter, useBranchLabel, ViewModeFilter } from "./report-sidebar-kit";
import { linesToCsv, ReportTable, type ReportColumn, type ReportLine } from "./report-table";
import { parseYmd, rangeText } from "./report-time-presets";
import { ReportViewer } from "./report-viewer";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DEFAULT_LOCALE, useLocale, useT } from "@/lib/i18n";
import { reportsNs } from "@/messages/reports";

type Totals = MonthRow & { damage: number; supplierDiscount: number };
type MonthValue = { month: string; value: number };
/** label: tên chỉ tiêu theo ngôn ngữ; vi: thuật ngữ kế toán tiếng Việt gốc (chỉ khi ngôn ngữ ≠ vi). */
type Line = { label: string; vi: string; values: number[] };
type RowKey = keyof typeof reportsNs.vi.finance.rows;
const ZERO = () => 0;

/**
 * Dòng Báo cáo kết quả hoạt động kinh doanh. Phí trả ĐTGH = phí giao hàng cửa hàng chịu (sổ công nợ đối tác giao hàng).
 * Chiết khấu thanh toán nhận từ NCC = phiếu chiết khấu (CKN…) còn hiệu lực trên sổ công nợ NCC → thu nhập khác.
 * Các khoản ứng dụng chưa có nguồn dữ liệu (voucher, hoàn tiền, thanh toán bằng điểm, chênh lệch làm tròn) luôn 0.
 * Tên chỉ tiêu là thuật ngữ kế toán VN: ở en/ja/zh hiện bản dịch kèm nguyên văn tiếng Việt (màn hình, in, CSV).
 */
const ROWS: { label: RowKey; level?: 1; f: (t: Totals) => number }[] = (() => {
  const net = (t: Totals) => t.sales - t.invoiceDiscount - t.returnValue;
  const cost = (t: Totals) => t.damage + t.paymentDiscount + t.salary + t.deliveryFee;
  const other = (t: Totals) => t.returnFee + t.otherIncome + t.supplierDiscount;
  return [
    { label: "sales", f: (t) => t.sales },
    { label: "deductions", f: (t) => t.invoiceDiscount + t.returnValue },
    { label: "invoiceDiscount", level: 1, f: (t) => t.invoiceDiscount },
    { label: "returns", level: 1, f: (t) => t.returnValue },
    { label: "netRevenue", f: net },
    { label: "cogs", f: (t) => t.cogs },
    { label: "grossProfit", f: (t) => net(t) - t.cogs },
    { label: "expenses", f: cost },
    { label: "voucherCost", level: 1, f: ZERO }, { label: "deliveryFee", level: 1, f: (t) => t.deliveryFee }, { label: "customerRefund", level: 1, f: ZERO },
    { label: "damage", level: 1, f: (t) => t.damage }, { label: "pointsPayment", level: 1, f: ZERO },
    { label: "paymentDiscount", level: 1, f: (t) => t.paymentDiscount }, { label: "salary", level: 1, f: (t) => t.salary },
    { label: "purchaseRounding", level: 1, f: ZERO }, { label: "saleRounding", level: 1, f: ZERO },
    { label: "operatingProfit", f: (t) => net(t) - t.cogs - cost(t) },
    { label: "otherIncome", f: other },
    { label: "returnFee", level: 1, f: (t) => t.returnFee }, { label: "purchaseRounding", level: 1, f: ZERO },
    { label: "saleRounding", level: 1, f: ZERO }, { label: "cashbookIncome", level: 1, f: (t) => t.otherIncome },
    { label: "supplierDiscount", level: 1, f: (t) => t.supplierDiscount },
    { label: "otherExpense", f: (t) => t.otherExpense },
    { label: "netProfit", f: (t) => net(t) - t.cogs - cost(t) + other(t) - t.otherExpense },
  ];
})();

const KEYS = ["sales", "invoiceDiscount", "returnValue", "cogs", "returnFee", "paymentDiscount", "salary", "otherExpense", "otherIncome", "damage", "deliveryFee", "supplierDiscount"] as const;
const total = (rows: Totals[]): Totals => {
  const t = { month: "" } as Totals;
  KEYS.forEach((k) => { t[k] = rows.reduce((s, r) => s + Number(r[k] || 0), 0); });
  return t;
};

/** Báo cáo tài chính (kết quả hoạt động kinh doanh): năm + Theo tháng / Theo quý, hoặc khoảng ngày tùy chỉnh (1 cột Tổng). */
export function FinanceReport() {
  const t = useT(reportsNs);
  const showVi = useLocale() !== DEFAULT_LOCALE;
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [mode, setMode] = useState<"month" | "quarter" | "range">("range");
  const [from, setFrom] = useState(ymd(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [to, setTo] = useState(ymd(now));
  const [branch, setBranch] = useState("");
  const branchLabel = useBranchLabel(branch);
  const range = mode === "range" ? { from: parseYmd(from), to: parseYmd(to) } : { from: new Date(year, 0, 1), to: new Date(year, 11, 31) };
  const span = { from: range.from, to: new Date(range.to.getFullYear(), range.to.getMonth(), range.to.getDate() + 1) };
  const p = { branchIds: branch || undefined };
  const salesQ = useReport<MonthRow[]>("/reports/finance", span, p);
  const dmgQ = useReport<MonthValue[]>("/reports/inventory/damages/monthly", span, p);
  const supQ = useReport<MonthValue[]>("/reports/suppliers/payment-discounts/monthly", span, p);
  const byMonth = new Map<string, Totals>();
  (salesQ.data ?? []).forEach((r) => byMonth.set(r.month, { ...r, damage: 0, supplierDiscount: 0 }));
  // Gộp số liệu product-service (xuất hủy, chiết khấu NCC) theo tháng vào dòng sales-service
  const merge = (rows: MonthValue[] | undefined, key: "damage" | "supplierDiscount") => (rows ?? []).forEach((d) =>
    byMonth.set(d.month, { ...(byMonth.get(d.month) ?? total([])), month: d.month, [key]: Number(d.value) }));
  merge(dmgQ.data, "damage");
  merge(supQ.data, "supplierDiscount");
  const queries = [salesQ, dmgQ, supQ];
  const months = [...byMonth.values()];
  const buckets: { label: string; t: Totals }[] = mode === "month"
    ? Array.from({ length: 12 }, (_, i) => ({ label: t("finance.month", { n: i + 1 }), t: total(months.filter((r) => r.month === `${year}-${String(i + 1).padStart(2, "0")}`)) }))
    : mode === "quarter" ? Array.from({ length: 4 }, (_, q) => ({ label: t("finance.quarter", { n: q + 1 }), t: total(months.filter((r) => Math.floor((+r.month.slice(5) - 1) / 3) === q)) }))
      : [];
  buckets.push({ label: t("common.total"), t: total(months) });
  const lines: ReportLine<Line>[] = ROWS.map((r, i) => ({ id: String(i), kind: "row", level: r.level, data: {
    label: t(`finance.rows.${r.label}`), vi: showVi ? reportsNs.vi.finance.rows[r.label] : "", values: buckets.map((b) => r.f(b.t)) } }));
  // CSV: "Bản dịch (nguyên văn tiếng Việt)"; màn hình + in: nguyên văn chữ nhỏ màu xám sau bản dịch
  const columns: ReportColumn<Line>[] = [{ key: "label", label: "", value: (l) => (l.vi ? `${l.label} (${l.vi})` : l.label), width: 220,
    render: (l) => (l.vi ? <>{l.label}<span className="rp-vi">({l.vi})</span></> : l.label) },
    ...buckets.map((b, i) => ({ key: `c${i}`, label: b.label, type: "money" as const, value: (l: Line) => l.values[i] }))];
  const exportCsv = () => { const csv = linesToCsv(columns, lines); downloadCsv(`bao-cao-tai-chinh-${ymd(range.from)}.csv`, [t("cols.metric"), ...csv.header.slice(1)], csv.rows); };
  const box = "flex h-[30px] flex-1 items-center justify-between rounded-md border bg-background px-2 text-[13px]";

  return (
    <ReportLayout title={t("finance.title")} sidebar={<>
      <ViewModeFilter value="report" onChange={() => undefined} reportOnly />
      <BranchFilter value={branch} onChange={setBranch} />
      <FilterSection title={t("filters.time")}>
        <SelectFilter value={String(year)} onChange={(v) => setYear(+v)} options={Array.from({ length: 6 }, (_, i) => String(now.getFullYear() - i)).map((y) => [y, y] as const)} />
        <RadioOption checked={mode !== "range"} onSelect={() => setMode("month")}>
          <select className={FILTER_FIELD} aria-label={t("finance.monthOrQuarter")} value={mode === "quarter" ? "quarter" : "month"}
            onChange={(e) => setMode(e.target.value as "month" | "quarter")}><option value="month">{t("finance.byMonth")}</option><option value="quarter">{t("finance.byQuarter")}</option></select>
        </RadioOption>
        <RadioOption checked={mode === "range"} onSelect={() => setMode("range")}>
          <DateRangePicker className={box} value={{ from, to }} onChange={(r) => { setFrom(r.from); setTo(r.to); setMode("range"); }} />
        </RadioOption>
      </FilterSection>
    </>}>
      <ReportViewer title={t("finance.paperTitle")} meta={[rangeText(t, range), branchLabel]} landscape note={showVi ? t("finance.viNote") : undefined}
        loading={queries.some((q) => q.isFetching)} onRefresh={() => queries.forEach((q) => q.refetch())} onExport={exportCsv}>
        {queries.some((q) => q.isError) ? <p className="rp-empty">{t("common.loadError")}</p> : <ReportTable columns={columns} lines={lines} />}
      </ReportViewer>
    </ReportLayout>
  );
}
