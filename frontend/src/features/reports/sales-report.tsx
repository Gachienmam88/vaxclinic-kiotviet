"use client";

import { useState } from "react";
import { downloadCsv } from "@/features/accounting/tax-calc";
import { ymd } from "@/features/dashboard/dashboard-date-utils";
import { BarChart, ChartCard, ColumnChart, EmptyChart } from "./report-charts";
import { SALE_MODES, spanOf, useReport, type DocRow, type SummaryRow } from "./report-api";
import { BranchFilter, ReportLayout, SelectFilter, useBranchLabel, ViewModeFilter, type ViewMode } from "./report-sidebar-kit";
import { asTable, linesToCsv, ReportTable, type ReportColumn } from "./report-table";
import { TimeFilter } from "./report-time-filter";
import { rangeText, timeLabel, timeRange, type TimeValue } from "./report-time-presets";
import { ReportViewer } from "./report-viewer";
import { dayChart, dayKey, profitColumns, revenueColumns, summaryLines } from "./summary-table-kit";
import { useCurrentUser } from "@/lib/use-current-user";
import { useChannelOptions, usePriceBookOptions } from "./report-filter-options";
import { DocCodeLink } from "@/components/ui/doc-code-link";

type Concern = "time" | "profit" | "discount" | "returns" | "seller" | "branch";
const CONCERNS: [Concern, string][] = [["time", "Thời gian"], ["profit", "Lợi nhuận"], ["discount", "Giảm giá HĐ"], ["returns", "Trả hàng"],
  ["seller", "Nhân viên"], ["branch", "Chi nhánh"]];
const TITLES: Record<Concern, string> = {
  time: "Báo cáo bán hàng theo thời gian", profit: "Báo cáo lợi nhuận theo thời gian", discount: "Báo cáo giảm giá hóa đơn",
  returns: "Báo cáo trả hàng", seller: "Báo cáo bán hàng theo nhân viên", branch: "Báo cáo bán hàng theo chi nhánh",
};
const GROUP: Partial<Record<Concern, string>> = { time: "DAY", profit: "DAY", seller: "SELLER", branch: "BRANCH" };

type DocAgg = { code: string; time: string; customer: string; qty: number; subtotal: number; discount: number; revenue: number; fee: number; paid: number };
const docAgg = (d: DocRow): DocAgg => ({ code: d.code, time: new Date(d.time).toLocaleString("vi-VN"), customer: d.customerName ?? "Khách lẻ",
  qty: Math.abs(d.qty), subtotal: Math.abs(d.subtotal), discount: Math.abs(d.discount), revenue: Math.abs(d.revenue), fee: d.fee, paid: Math.abs(d.paid) });
const dm = (key: keyof DocAgg, label: string, type: "money" | "qty" = "money"): ReportColumn<DocAgg> => ({ key, label, type, value: (r) => r[key] });
const DOC_COLS = { code: { key: "code", label: "Mã chứng từ", value: (r: DocAgg) => r.code, render: (r: DocAgg) => <DocCodeLink code={r.code} /> },
  time: { key: "time", label: "Thời gian", value: (r: DocAgg) => r.time }, customer: { key: "customer", label: "Khách hàng", value: (r: DocAgg) => r.customer } };
const DISCOUNT_COLS: ReportColumn<DocAgg>[] = [DOC_COLS.code, DOC_COLS.time, DOC_COLS.customer, dm("subtotal", "Tổng tiền hàng"), dm("discount", "Giảm giá HĐ"), dm("revenue", "Doanh thu")];
const RETURN_COLS: ReportColumn<DocAgg>[] = [DOC_COLS.code, DOC_COLS.time, DOC_COLS.customer, dm("qty", "SL", "qty"), dm("revenue", "Giá trị trả"), dm("fee", "Phí trả hàng"), dm("paid", "Đã trả khách")];

/** Báo cáo bán hàng: Biểu đồ (Doanh thu thuần theo ngày...) / Báo cáo, Mối quan tâm Thời gian, Lợi nhuận, Giảm giá HĐ, Trả hàng, Nhân viên, Chi nhánh. */
export function SalesReport() {
  const [mode, setMode] = useState<ViewMode>("chart");
  const [concern, setConcern] = useState<Concern>("time");
  const [time, setTime] = useState<TimeValue>({ mode: "preset", preset: "thisWeek" });
  const [saleMode, setSaleMode] = useState("");
  const [branch, setBranch] = useState("");
  const [channel, setChannel] = useState("");
  const [priceBook, setPriceBook] = useState("");
  const priceBooks = usePriceBookOptions();
  const channels = useChannelOptions();
  const branchLabel = useBranchLabel(branch);
  const { data: me } = useCurrentUser();
  const range = timeRange(time);
  const params = { branchIds: branch || undefined, saleModes: saleMode || undefined, channels: channel || undefined, priceBookIds: priceBook || undefined };
  const group = GROUP[concern];
  const sumQ = useReport<SummaryRow[]>("/reports/sales/summary", spanOf(range), { ...params, groupBy: group }, !!group);
  const docQ = useReport<DocRow[]>("/reports/end-of-day/sales", spanOf(range), params, !group);
  const rows = sumQ.data ?? [];
  const docs = (docQ.data ?? []).filter((d) => (concern === "discount" ? d.kind === "INVOICE" && Number(d.discount) > 0 : d.kind === "RETURN"));
  const branchName = (r: SummaryRow) => me?.user.branches.find((b) => b.id === r.key)?.name ?? r.key;

  const table = concern === "time" ? asTable(revenueColumns("Thời gian"), summaryLines(rows, `Tổng: ${rows.length} ngày`, (r) => r.key.split("-").reverse().join("/")))
    : concern === "profit" ? asTable(profitColumns("Thời gian"), summaryLines(rows, "Tổng", (r) => r.key.split("-").reverse().join("/")))
      : concern === "seller" ? asTable(profitColumns("Người bán"), summaryLines(rows, `SL nhân viên: ${rows.length}`))
        : concern === "branch" ? asTable(profitColumns("Chi nhánh"), summaryLines(rows, `SL chi nhánh: ${rows.length}`, branchName))
          : asTable(concern === "discount" ? DISCOUNT_COLS : RETURN_COLS, docs.length ? [
            { id: "sum", kind: "sum" as const, label: `${concern === "discount" ? "SL hóa đơn" : "SL phiếu trả"}: ${docs.length}`,
              data: docs.map(docAgg).reduce((a, d) => ({ ...a, qty: a.qty + d.qty, subtotal: a.subtotal + d.subtotal, discount: a.discount + d.discount,
                revenue: a.revenue + d.revenue, fee: a.fee + d.fee, paid: a.paid + d.paid }), { ...docAgg(docs[0]), code: "", time: "", customer: "", qty: 0, subtotal: 0, discount: 0, revenue: 0, fee: 0, paid: 0 }) },
            ...docs.map((d) => ({ id: d.id, kind: "row" as const, data: docAgg(d) }))] : []);

  const chart = () => {
    const label = timeLabel(time);
    if (concern === "seller" || concern === "branch") {
      const items = rows.map((r) => ({ label: concern === "branch" ? branchName(r) : r.name, value: Number(r.revenue) - Number(r.returnValue) }));
      return <ChartCard title={`Doanh thu thuần theo ${concern === "branch" ? "chi nhánh" : "nhân viên"} ${label}`}>{items.length ? <BarChart items={items} /> : <EmptyChart />}</ChartCard>;
    }
    const values = new Map<string, number>();
    if (group) rows.forEach((r) => values.set(r.key, concern === "profit" ? Number(r.revenue) - Number(r.returnValue) - Number(r.cogs) : Number(r.revenue) - Number(r.returnValue)));
    else docs.forEach((d) => values.set(dayKey(d.time), (values.get(dayKey(d.time)) ?? 0) + Math.abs(Number(concern === "discount" ? d.discount : d.revenue))));
    const titles: Record<string, string> = { time: "Doanh thu thuần", profit: "Lợi nhuận gộp", discount: "Giảm giá hóa đơn", returns: "Giá trị trả hàng" };
    return <ChartCard title={`${titles[concern]} ${label}`}><ColumnChart items={dayChart(range, values)} /></ChartCard>;
  };
  const active = group ? sumQ : docQ;
  const exportCsv = () => { const t = linesToCsv(table.columns, table.lines); downloadCsv(`bao-cao-ban-hang-${concern}-${ymd(range.from)}.csv`, t.header, t.rows); };

  return (
    <ReportLayout title="Báo cáo bán hàng" sidebar={<>
      <ViewModeFilter value={mode} onChange={setMode} />
      <SelectFilter title="Mối quan tâm" value={concern} onChange={(v) => setConcern(v as Concern)} options={CONCERNS} />
      <BranchFilter value={branch} onChange={setBranch} />
      <SelectFilter title="Bảng giá" value={priceBook} onChange={setPriceBook} placeholder="Chọn bảng giá" options={priceBooks} />
      <TimeFilter value={time} onChange={setTime} />
      <SelectFilter title="Phương thức bán hàng" value={saleMode} onChange={setSaleMode} placeholder="Chọn phương thức bán hàng" options={SALE_MODES} />
      <SelectFilter title="Kênh bán" value={channel} onChange={setChannel} placeholder="Chọn kênh bán" options={channels} />
    </>}>
      {mode === "chart" ? chart() : (
        <ReportViewer title={TITLES[concern]} meta={[rangeText(range), `Chi nhánh: ${branchLabel}`]} landscape={concern !== "time"}
          loading={active.isFetching} onRefresh={() => active.refetch()} onExport={table.lines.length ? exportCsv : undefined}>
          {active.isError ? <p className="rp-empty">Không tải được báo cáo</p> : <ReportTable columns={table.columns} lines={table.lines} />}
        </ReportViewer>)}
    </ReportLayout>
  );
}
