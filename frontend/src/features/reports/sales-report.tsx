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
import { useT } from "@/lib/i18n";
import { reportsNs, type ReportsT } from "@/messages/reports";

type Concern = "time" | "profit" | "discount" | "returns" | "seller" | "branch";
/** Mối quan tâm; nhãn "sales.concerns.<…>", tiêu đề "sales.titles.<…>", biểu đồ "sales.charts.<…>". */
const CONCERNS: Concern[] = ["time", "profit", "discount", "returns", "seller", "branch"];
const GROUP: Partial<Record<Concern, string>> = { time: "DAY", profit: "DAY", seller: "SELLER", branch: "BRANCH" };

type DocAgg = { code: string; time: string; customer: string; qty: number; subtotal: number; discount: number; revenue: number; fee: number; paid: number };
const docAgg = (t: ReportsT, d: DocRow): DocAgg => ({ code: d.code, time: new Date(d.time).toLocaleString("vi-VN"), customer: d.customerName ?? t("common.walkIn"),
  qty: Math.abs(d.qty), subtotal: Math.abs(d.subtotal), discount: Math.abs(d.discount), revenue: Math.abs(d.revenue), fee: d.fee, paid: Math.abs(d.paid) });
const dm = (key: keyof DocAgg, label: string, type: "money" | "qty" = "money"): ReportColumn<DocAgg> => ({ key, label, type, value: (r) => r[key] });
/** Cột bảng chứng từ: Giảm giá HĐ hoặc Trả hàng (nhãn theo ngôn ngữ). */
function docColumns(t: ReportsT, discount: boolean): ReportColumn<DocAgg>[] {
  const head: ReportColumn<DocAgg>[] = [{ key: "code", label: t("cols.docCode"), value: (r) => r.code, render: (r) => <DocCodeLink code={r.code} /> },
    { key: "time", label: t("cols.time"), value: (r) => r.time }, { key: "customer", label: t("cols.customer"), value: (r) => r.customer }];
  return discount ? [...head, dm("subtotal", t("cols.subtotal")), dm("discount", t("cols.invoiceDiscount")), dm("revenue", t("cols.revenue"))]
    : [...head, dm("qty", t("cols.qty"), "qty"), dm("revenue", t("cols.returnValue")), dm("fee", t("cols.returnFee")), dm("paid", t("cols.refunded"))];
}

/** Báo cáo bán hàng: Biểu đồ (Doanh thu thuần theo ngày...) / Báo cáo, Mối quan tâm Thời gian, Lợi nhuận, Giảm giá HĐ, Trả hàng, Nhân viên, Chi nhánh. */
export function SalesReport() {
  const t = useT(reportsNs);
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

  const table = concern === "time" ? asTable(revenueColumns(t, t("cols.time")), summaryLines(rows, t("sales.sumDays", { n: rows.length }), (r) => r.key.split("-").reverse().join("/")))
    : concern === "profit" ? asTable(profitColumns(t, t("cols.time")), summaryLines(rows, t("common.total"), (r) => r.key.split("-").reverse().join("/")))
      : concern === "seller" ? asTable(profitColumns(t, t("cols.seller")), summaryLines(rows, t("sales.sellerCount", { n: rows.length })))
        : concern === "branch" ? asTable(profitColumns(t, t("cols.branch")), summaryLines(rows, t("sales.branchCount", { n: rows.length }), branchName))
          : asTable(docColumns(t, concern === "discount"), docs.length ? [
            { id: "sum", kind: "sum" as const, label: t(concern === "discount" ? "sales.invoiceCount" : "sales.returnCount", { n: docs.length }),
              data: docs.map((d) => docAgg(t, d)).reduce((a, d) => ({ ...a, qty: a.qty + d.qty, subtotal: a.subtotal + d.subtotal, discount: a.discount + d.discount,
                revenue: a.revenue + d.revenue, fee: a.fee + d.fee, paid: a.paid + d.paid }), { ...docAgg(t, docs[0]), code: "", time: "", customer: "", qty: 0, subtotal: 0, discount: 0, revenue: 0, fee: 0, paid: 0 }) },
            ...docs.map((d) => ({ id: d.id, kind: "row" as const, data: docAgg(t, d) }))] : []);

  const chart = () => {
    const period = timeLabel(t, time);
    if (concern === "seller" || concern === "branch") {
      const items = rows.map((r) => ({ label: concern === "branch" ? branchName(r) : r.name, value: Number(r.revenue) - Number(r.returnValue) }));
      return <ChartCard title={t(`sales.charts.${concern}`, { period })}>{items.length ? <BarChart items={items} /> : <EmptyChart />}</ChartCard>;
    }
    const values = new Map<string, number>();
    if (group) rows.forEach((r) => values.set(r.key, concern === "profit" ? Number(r.revenue) - Number(r.returnValue) - Number(r.cogs) : Number(r.revenue) - Number(r.returnValue)));
    else docs.forEach((d) => values.set(dayKey(d.time), (values.get(dayKey(d.time)) ?? 0) + Math.abs(Number(concern === "discount" ? d.discount : d.revenue))));
    return <ChartCard title={t(`sales.charts.${concern}`, { period })}><ColumnChart items={dayChart(range, values)} /></ChartCard>;
  };
  const active = group ? sumQ : docQ;
  const exportCsv = () => { const csv = linesToCsv(table.columns, table.lines); downloadCsv(`bao-cao-ban-hang-${concern}-${ymd(range.from)}.csv`, csv.header, csv.rows); };

  return (
    <ReportLayout title={t("sales.title")} sidebar={<>
      <ViewModeFilter value={mode} onChange={setMode} />
      <SelectFilter title={t("filters.concern")} value={concern} onChange={(v) => setConcern(v as Concern)}
        options={CONCERNS.map((c) => [c, t(`sales.concerns.${c}`)] as const)} />
      <BranchFilter value={branch} onChange={setBranch} />
      <SelectFilter title={t("filters.priceBook")} value={priceBook} onChange={setPriceBook} placeholder={t("filters.pickPriceBook")} options={priceBooks} />
      <TimeFilter value={time} onChange={setTime} />
      <SelectFilter title={t("filters.saleMode")} value={saleMode} onChange={setSaleMode} placeholder={t("filters.pickSaleMode")}
        options={SALE_MODES.map((m) => [m, t(`saleModes.${m}`)] as const)} />
      <SelectFilter title={t("filters.channel")} value={channel} onChange={setChannel} placeholder={t("filters.pickChannel")} options={channels} />
    </>}>
      {mode === "chart" ? chart() : (
        <ReportViewer title={t(`sales.titles.${concern}`)} meta={[rangeText(t, range), t("common.branchMeta", { branch: branchLabel })]} landscape={concern !== "time"}
          loading={active.isFetching} onRefresh={() => active.refetch()} onExport={table.lines.length ? exportCsv : undefined}>
          {active.isError ? <p className="rp-empty">{t("common.loadError")}</p> : <ReportTable columns={table.columns} lines={table.lines} />}
        </ReportViewer>)}
    </ReportLayout>
  );
}
