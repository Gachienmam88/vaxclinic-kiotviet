"use client";

import { useState } from "react";
import { downloadCsv } from "@/features/accounting/tax-calc";
import { ymd } from "@/features/dashboard/dashboard-date-utils";
import { useUserLookup } from "@/features/purchases/purchase-queries";
import { useT } from "@/lib/i18n";
import { reportsNs, type ReportsT } from "@/messages/reports";
import { fromSales, productColumns, withTotal } from "./products-report-tables";
import { BarChart, ChartCard, EmptyChart, PieChart } from "./report-charts";
import { useChannelOptions } from "./report-filter-options";
import { spanOf, useReport, type DebtRow, type ProductRow, type SummaryRow } from "./report-api";
import { BranchFilter, CustomerFilter, ReportLayout, SelectFilter, useBranchLabel, ViewModeFilter, type PickedCustomer, type ViewMode } from "./report-sidebar-kit";
import { asTable, linesToCsv, ReportTable, type ReportColumn, type ReportLine } from "./report-table";
import { TimeFilter } from "./report-time-filter";
import { rangeText, timeRange, type TimeValue } from "./report-time-presets";
import { ReportViewer } from "./report-viewer";
import { profitColumns, revenueColumns, summaryLines, top10 } from "./summary-table-kit";
import { DocCodeLink } from "@/components/ui/doc-code-link";

export type PartyConcern = "sales" | "products" | "debt" | "profit";
/** Chữ của 1 báo cáo đối tượng (đã dịch). noun: danh từ chèn trong câu ("khách hàng" / "customers"). */
export type PartyText = {
  title: string; noun: string; concerns: [PartyConcern, string][]; titles: Partial<Record<PartyConcern, string>>; chartTitle: string;
  firstCol: string; codeCol?: string; note?: string;
};
export type PartyConfig = {
  page: string; groupBy: "CUSTOMER" | "SELLER" | "CHANNEL"; productsBy?: "CUSTOMER" | "SELLER"; pie?: boolean;
  filters: ("customer" | "seller" | "channel")[]; text: (t: ReportsT) => PartyText;
};

const debtMoney = (key: keyof DebtRow, label: string): ReportColumn<DebtRow> => ({ key, label, type: "money", value: (r) => r[key] as number });
export const debtColumns = (t: ReportsT, codeLabel: string, nameLabel: string): ReportColumn<DebtRow>[] => [
  { key: "code", label: codeLabel, value: (r) => r.code, render: (r) => <b><DocCodeLink code={r.code} /></b> },
  { key: "name", label: nameLabel, value: (r) => r.name }, debtMoney("opening", t("cols.openingDebt")), debtMoney("debit", t("cols.debit")),
  debtMoney("credit", t("cols.credit")), debtMoney("closing", t("cols.closingDebt")),
];
export function debtLines(rows: DebtRow[], label: string): ReportLine<DebtRow>[] {
  if (!rows.length) return [];
  const s = (k: "opening" | "debit" | "credit" | "closing") => rows.reduce((a, r) => a + Number(r[k]), 0);
  return [{ id: "sum", kind: "sum", label, data: { code: "", name: "", phone: null, opening: s("opening"), debit: s("debit"), credit: s("credit"), closing: s("closing") } },
    ...rows.map((r, i) => ({ id: `${r.code}-${i}`, kind: "row" as const, data: r }))];
}

/** Báo cáo theo đối tượng bán hàng (khách hàng / nhân viên / kênh bán): biểu đồ Top 10 hoặc tròn, báo cáo theo mối quan tâm. */
export function PartyReport({ cfg }: { cfg: PartyConfig }) {
  const t = useT(reportsNs);
  const tx = cfg.text(t);
  const [mode, setMode] = useState<ViewMode>("chart");
  const [concern, setConcern] = useState<PartyConcern>("sales");
  const [time, setTime] = useState<TimeValue>({ mode: "preset", preset: "thisWeek" });
  const [customer, setCustomer] = useState<PickedCustomer>(null);
  const [seller, setSeller] = useState("");
  const [channel, setChannel] = useState("");
  const [branch, setBranch] = useState("");
  const { data: users = [] } = useUserLookup();
  const branchLabel = useBranchLabel(branch);
  const range = timeRange(time), span = spanOf(range);
  const channels = useChannelOptions();
  const params = { branchIds: branch || undefined, customerId: customer?.id, sellerId: seller || undefined, channels: channel || undefined };
  const sumQ = useReport<SummaryRow[]>("/reports/sales/summary", span, { ...params, groupBy: cfg.groupBy }, concern === "sales" || concern === "profit");
  const prodQ = useReport<ProductRow[]>("/reports/sales/products", span, { ...params, by: cfg.productsBy }, concern === "products");
  const debtQ = useReport<DebtRow[]>("/reports/customers/debt", span, { customerId: customer?.id }, concern === "debt");
  const rows = sumQ.data ?? [];
  const sumLabel = t("party.countOf", { noun: tx.noun, n: rows.length });
  const prodRows = (prodQ.data ?? []).map(fromSales).sort((a, b) => a.dim.localeCompare(b.dim) || b.v.net - a.v.net);
  const table = concern === "sales" ? asTable(revenueColumns(t, tx.firstCol, tx.codeCol), summaryLines(rows, sumLabel))
    : concern === "profit" ? asTable(profitColumns(t, tx.firstCol, tx.codeCol), summaryLines(rows, sumLabel))
      : concern === "products" ? asTable(productColumns(t)[cfg.productsBy === "SELLER" ? "seller" : "customer"],
          withTotal(prodRows, t("party.countOf", { noun: tx.noun, n: new Set(prodRows.map((r) => r.dim)).size })))
        : asTable(debtColumns(t, t("cols.customerCode"), t("cols.customerName")), debtLines(debtQ.data ?? [], t("party.customerCount", { n: (debtQ.data ?? []).length })));
  const active = concern === "products" ? prodQ : concern === "debt" ? debtQ : sumQ;
  const exportCsv = () => { const csv = linesToCsv(table.columns, table.lines); downloadCsv(`${cfg.page}-${concern}-${ymd(range.from)}.csv`, csv.header, csv.rows); };

  const chart = () => {
    const items = concern === "debt" ? (debtQ.data ?? []).map((d) => ({ label: d.name, value: Number(d.closing) }))
      : concern === "products" ? prodRows.map((r) => ({ label: `${r.dim} - ${r.name}`, value: r.v.net }))
        : rows.map((r) => ({ label: r.name, value: concern === "profit" ? Number(r.revenue) - Number(r.returnValue) - Number(r.cogs) : Number(r.revenue) - Number(r.returnValue) }));
    const title = concern === "debt" ? t("party.chartDebt") : concern === "profit" ? t("party.chartProfit", { noun: tx.noun })
      : concern === "products" ? t("party.chartProducts", { noun: tx.noun }) : tx.chartTitle;
    return (
      <ChartCard title={title}>
        {cfg.pie && concern === "sales" ? <PieChart items={items} /> : top10(items).length ? <BarChart items={top10(items)} /> : <EmptyChart />}
      </ChartCard>);
  };

  return (
    <ReportLayout title={tx.title} sidebar={<>
      <ViewModeFilter value={mode} onChange={setMode} />
      <SelectFilter title={t("filters.concern")} value={concern} onChange={(v) => setConcern(v as PartyConcern)} options={tx.concerns} />
      <BranchFilter value={branch} onChange={setBranch} />
      <TimeFilter value={time} onChange={setTime} />
      {cfg.filters.includes("customer") && <CustomerFilter value={customer} onChange={setCustomer} />}
      {cfg.filters.includes("seller") && <SelectFilter title={t("filters.seller")} value={seller} onChange={setSeller} placeholder={t("filters.pickSeller")} options={users.map((u) => [u.id, u.fullName] as const)} />}
      {cfg.filters.includes("channel") && <SelectFilter title={t("filters.channel")} value={channel} onChange={setChannel} placeholder={t("filters.pickChannel")} options={channels} />}
    </>}>
      {mode === "chart" ? chart() : (
        <ReportViewer title={tx.titles[concern] ?? ""}
          meta={[rangeText(t, range), concern === "debt" ? t("party.debtBranchMeta") : t("common.branchMeta", { branch: branchLabel })]}
          note={concern === "products" ? t("common.allocatedDiscount") : tx.note}
          landscape={concern === "profit" || concern === "products"} loading={active.isFetching} onRefresh={() => active.refetch()}
          onExport={table.lines.length ? exportCsv : undefined}>
          {active.isError ? <p className="rp-empty">{t("common.loadError")}</p> : <ReportTable columns={table.columns} lines={table.lines} />}
        </ReportViewer>)}
    </ReportLayout>
  );
}
