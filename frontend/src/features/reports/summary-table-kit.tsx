/**
 * Bảng tổng hợp doanh thu theo 1 chiều (thời gian / người bán / khách hàng / chi nhánh / kênh) dùng chung cho
 * Báo cáo bán hàng, khách hàng, nhân viên, kênh bán: dòng tổng nền be + mỗi nhóm 1 dòng.
 */
import { chartBuckets, type DateRange } from "./report-time-presets";
import { sumOf, type SummaryRow } from "./report-api";
import type { ChartItem } from "./report-charts";
import type { ReportColumn, ReportLine } from "./report-table";
import { DocCodeLink } from "@/components/ui/doc-code-link";
import type { ReportsT } from "@/messages/reports";

export type SumAgg = {
  label: string; code: string; count: number; subtotal: number; discount: number; revenue: number; returnValue: number;
  net: number; cogs: number; profit: number;
};

export const toAgg = (r: SummaryRow, label = r.name || r.key): SumAgg => {
  const net = Number(r.revenue) - Number(r.returnValue);
  return { label, code: r.code, count: Number(r.invoiceCount), subtotal: Number(r.subtotal), discount: Number(r.discount),
    revenue: Number(r.revenue), returnValue: Number(r.returnValue), net, cogs: Number(r.cogs), profit: net - Number(r.cogs) };
};

const totalAgg = (list: SumAgg[], label: string): SumAgg => ({
  label, code: "", count: sumOf(list, (r) => r.count), subtotal: sumOf(list, (r) => r.subtotal), discount: sumOf(list, (r) => r.discount),
  revenue: sumOf(list, (r) => r.revenue), returnValue: sumOf(list, (r) => r.returnValue), net: sumOf(list, (r) => r.net),
  cogs: sumOf(list, (r) => r.cogs), profit: sumOf(list, (r) => r.profit),
});

/** Dòng tổng (nhãn sumLabel) + các dòng; labelOf đổi khóa (VD id chi nhánh) thành tên hiển thị. */
export function summaryLines(rows: SummaryRow[], sumLabel: string, labelOf?: (r: SummaryRow) => string): ReportLine<SumAgg>[] {
  const list = rows.map((r) => toAgg(r, labelOf ? labelOf(r) : undefined));
  if (!list.length) return [];
  return [{ id: "sum", kind: "sum", label: sumLabel, data: totalAgg(list, sumLabel) },
    ...list.map((a, i) => ({ id: `${rows[i].key}-${i}`, kind: "row" as const, data: a }))];
}

const money = (key: keyof SumAgg, label: string): ReportColumn<SumAgg> => ({ key, label, type: "money", value: (r) => r[key] });

/** Doanh thu: [nhãn, (mã)], Doanh thu, Giá trị trả, Doanh thu thuần. */
export function revenueColumns(t: ReportsT, first: string, codeLabel?: string): ReportColumn<SumAgg>[] {
  return [
    ...(codeLabel ? [{ key: "code", label: codeLabel, value: (r: SumAgg) => r.code, render: (r: SumAgg) => <b><DocCodeLink code={r.code} /></b> }] : []),
    { key: "label", label: first, value: (r) => r.label },
    money("revenue", t("cols.revenue")), money("returnValue", t("cols.returnValue")), money("net", t("cols.net")),
  ];
}

/** Lợi nhuận: nhãn, Tổng tiền hàng, Giảm giá HĐ, Doanh thu, Giá trị trả, Doanh thu thuần, Tổng giá vốn, Lợi nhuận gộp. */
export function profitColumns(t: ReportsT, first: string, codeLabel?: string): ReportColumn<SumAgg>[] {
  return [
    ...revenueColumns(t, first, codeLabel).slice(0, codeLabel ? 2 : 1), money("subtotal", t("cols.subtotal")), money("discount", t("cols.invoiceDiscount")),
    money("revenue", t("cols.revenue")), money("returnValue", t("cols.returnValue")), money("net", t("cols.net")), money("cogs", t("cols.cogs")),
    money("profit", t("cols.grossProfit")),
  ];
}

/** Cột biểu đồ theo ngày (hoặc tháng nếu khoảng dài) từ các dòng có khóa yyyy-MM-dd; chỉ tới hôm nay. */
export function dayChart(range: DateRange, values: Map<string, number>): ChartItem[] {
  const today = new Date();
  const to = range.to > today ? new Date(today.getFullYear(), today.getMonth(), today.getDate()) : range.to;
  if (to < range.from) return [];
  const buckets = chartBuckets({ from: range.from, to });
  const monthly = buckets[0]?.key.length === 7;
  const acc = new Map<string, number>();
  values.forEach((v, k) => { const key = monthly ? k.slice(0, 7) : k; acc.set(key, (acc.get(key) ?? 0) + v); });
  return buckets.map((b) => ({ label: b.label, value: acc.get(b.key) ?? 0 }));
}

/** yyyy-MM-dd theo giờ máy của 1 thời điểm ISO. */
export const dayKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Top 10 theo giá trị (giảm dần), bỏ giá trị ≤ 0. */
export const top10 = (items: ChartItem[]) => items.filter((i) => i.value > 0).sort((a, b) => b.value - a.value).slice(0, 10);
