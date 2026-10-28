"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { downloadCsv } from "@/features/accounting/tax-calc";
import { ymd } from "@/features/dashboard/dashboard-date-utils";
import { FILTER_FIELD, FilterSection, RadioOption } from "@/features/sales/invoice-list-kit";
import { useReport, type MonthRow } from "./report-api";
import { BranchFilter, ReportLayout, SelectFilter, useBranchLabel, ViewModeFilter } from "./report-sidebar-kit";
import { linesToCsv, ReportTable, type ReportColumn, type ReportLine } from "./report-table";
import { dmy, parseYmd, rangeText } from "./report-time-presets";
import { ReportViewer } from "./report-viewer";

type Totals = MonthRow & { damage: number };
type Line = { label: string; values: number[] };
const ZERO = () => 0;

/**
 * Dòng Báo cáo kết quả hoạt động kinh doanh. Các khoản ứng dụng chưa có nguồn dữ liệu (voucher, phí trả ĐTGH,
 * hoàn tiền, thanh toán bằng điểm, chênh lệch làm tròn) luôn 0.
 */
const ROWS: { label: string; level?: 1; f: (t: Totals) => number }[] = (() => {
  const net = (t: Totals) => t.sales - t.invoiceDiscount - t.returnValue;
  const cost = (t: Totals) => t.damage + t.paymentDiscount + t.salary;
  const other = (t: Totals) => t.returnFee + t.otherIncome;
  return [
    { label: "Doanh thu bán hàng (1)", f: (t) => t.sales },
    { label: "Giảm trừ Doanh thu (2 = 2.1+2.2)", f: (t) => t.invoiceDiscount + t.returnValue },
    { label: "Chiết khấu hóa đơn (2.1)", level: 1, f: (t) => t.invoiceDiscount },
    { label: "Giá trị hàng bán bị trả lại (2.2)", level: 1, f: (t) => t.returnValue },
    { label: "Doanh thu thuần (3=1-2)", f: net },
    { label: "Giá vốn hàng bán (4)", f: (t) => t.cogs },
    { label: "Lợi nhuận gộp về bán hàng (5=3-4)", f: (t) => net(t) - t.cogs },
    { label: "Chi phí (6)", f: cost },
    { label: "Chi phí voucher", level: 1, f: ZERO }, { label: "Phí trả ĐTGH", level: 1, f: ZERO }, { label: "Hoàn tiền cho khách", level: 1, f: ZERO },
    { label: "Xuất hủy hàng hóa", level: 1, f: (t) => t.damage }, { label: "Giá trị thanh toán bằng điểm", level: 1, f: ZERO },
    { label: "Chiết khấu thanh toán cho khách", level: 1, f: (t) => t.paymentDiscount }, { label: "Chi trả lương NV", level: 1, f: (t) => t.salary },
    { label: "Chênh lệch làm tròn nhập hàng", level: 1, f: ZERO }, { label: "Chênh lệch làm tròn bán hàng", level: 1, f: ZERO },
    { label: "Lợi nhuận từ hoạt động kinh doanh (7=5-6)", f: (t) => net(t) - t.cogs - cost(t) },
    { label: "Thu nhập khác (8)", f: other },
    { label: "Phí trả hàng", level: 1, f: (t) => t.returnFee }, { label: "Chênh lệch làm tròn nhập hàng", level: 1, f: ZERO },
    { label: "Chênh lệch làm tròn bán hàng", level: 1, f: ZERO }, { label: "Thu khác (Sổ quỹ)", level: 1, f: (t) => t.otherIncome },
    { label: "Chi phí khác (9)", f: (t) => t.otherExpense },
    { label: "Lợi nhuận thuần (10=7+8-9)", f: (t) => net(t) - t.cogs - cost(t) + other(t) - t.otherExpense },
  ];
})();

const KEYS = ["sales", "invoiceDiscount", "returnValue", "cogs", "returnFee", "paymentDiscount", "salary", "otherExpense", "otherIncome", "damage"] as const;
const total = (rows: Totals[]): Totals => {
  const t = { month: "", damage: 0 } as Totals;
  KEYS.forEach((k) => { t[k] = rows.reduce((s, r) => s + Number(r[k] || 0), 0); });
  return t;
};

/** Báo cáo tài chính (kết quả hoạt động kinh doanh): năm + Theo tháng / Theo quý, hoặc khoảng ngày tùy chỉnh (1 cột Tổng). */
export function FinanceReport() {
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
  const dmgQ = useReport<{ month: string; value: number }[]>("/reports/inventory/damages/monthly", span, p);
  const byMonth = new Map<string, Totals>();
  (salesQ.data ?? []).forEach((r) => byMonth.set(r.month, { ...r, damage: 0 }));
  (dmgQ.data ?? []).forEach((d) => byMonth.set(d.month, { ...(byMonth.get(d.month) ?? total([])), month: d.month, damage: Number(d.value) }));
  const months = [...byMonth.values()];
  const buckets: { label: string; t: Totals }[] = mode === "month"
    ? Array.from({ length: 12 }, (_, i) => ({ label: `Tháng ${i + 1}`, t: total(months.filter((r) => r.month === `${year}-${String(i + 1).padStart(2, "0")}`)) }))
    : mode === "quarter" ? Array.from({ length: 4 }, (_, q) => ({ label: `Quý ${q + 1}`, t: total(months.filter((r) => Math.floor((+r.month.slice(5) - 1) / 3) === q)) }))
      : [];
  buckets.push({ label: "Tổng", t: total(months) });
  const lines: ReportLine<Line>[] = ROWS.map((r, i) => ({ id: String(i), kind: "row", level: r.level, data: { label: r.label, values: buckets.map((b) => r.f(b.t)) } }));
  const columns: ReportColumn<Line>[] = [{ key: "label", label: "", value: (l) => l.label, width: 220 },
    ...buckets.map((b, i) => ({ key: `c${i}`, label: b.label, type: "money" as const, value: (l: Line) => l.values[i] }))];
  const exportCsv = () => { const t = linesToCsv(columns, lines); downloadCsv(`bao-cao-tai-chinh-${ymd(range.from)}.csv`, ["Chỉ tiêu", ...t.header.slice(1)], t.rows); };
  const box = "flex h-[30px] flex-1 items-center justify-between rounded-md border bg-background px-2 text-[13px]";

  return (
    <ReportLayout title="Báo cáo tài chính" sidebar={<>
      <ViewModeFilter value="report" onChange={() => undefined} reportOnly />
      <BranchFilter value={branch} onChange={setBranch} />
      <FilterSection title="Thời gian">
        <SelectFilter value={String(year)} onChange={(v) => setYear(+v)} options={Array.from({ length: 6 }, (_, i) => String(now.getFullYear() - i)).map((y) => [y, y] as const)} />
        <RadioOption checked={mode !== "range"} onSelect={() => setMode("month")}>
          <select className={FILTER_FIELD} aria-label="Theo tháng / quý" value={mode === "quarter" ? "quarter" : "month"}
            onChange={(e) => setMode(e.target.value as "month" | "quarter")}><option value="month">Theo Tháng</option><option value="quarter">Theo Quý</option></select>
        </RadioOption>
        <RadioOption checked={mode === "range"} onSelect={() => setMode("range")}>
          <span className={box}>{dmy(parseYmd(from))} - {dmy(parseYmd(to))} <CalendarDays className="size-4 shrink-0 text-muted-foreground" /></span>
        </RadioOption>
        {mode === "range" && (
          <div className="grid gap-1.5 pl-6">
            <input type="date" aria-label="Từ ngày" className={FILTER_FIELD} value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} />
            <input type="date" aria-label="Đến ngày" className={FILTER_FIELD} value={to} onChange={(e) => e.target.value && setTo(e.target.value)} />
          </div>)}
      </FilterSection>
    </>}>
      <ReportViewer title="Báo cáo kết quả hoạt động kinh doanh" meta={[rangeText(range), branchLabel]} landscape
        loading={salesQ.isFetching || dmgQ.isFetching} onRefresh={() => { salesQ.refetch(); dmgQ.refetch(); }} onExport={exportCsv}>
        {salesQ.isError || dmgQ.isError ? <p className="rp-empty">Không tải được báo cáo</p> : <ReportTable columns={columns} lines={lines} />}
      </ReportViewer>
    </ReportLayout>
  );
}
