"use client";

import { useState } from "react";
import { downloadCsv } from "@/features/accounting/tax-calc";
import { ymd } from "@/features/dashboard/dashboard-date-utils";
import { useUserLookup } from "@/features/purchases/purchase-queries";
import { COLUMNS, fromSales, withTotal } from "./products-report-tables";
import { BarChart, ChartCard, EmptyChart, PieChart } from "./report-charts";
import { spanOf, useReport, type DebtRow, type ProductRow, type SummaryRow } from "./report-api";
import { BranchFilter, CustomerFilter, ReportLayout, SelectFilter, useBranchLabel, ViewModeFilter, type PickedCustomer, type ViewMode } from "./report-sidebar-kit";
import { asTable, linesToCsv, ReportTable, type ReportColumn, type ReportLine } from "./report-table";
import { TimeFilter } from "./report-time-filter";
import { rangeText, timeRange, type TimeValue } from "./report-time-presets";
import { ReportViewer } from "./report-viewer";
import { profitColumns, revenueColumns, summaryLines, top10 } from "./summary-table-kit";

export type PartyConcern = "sales" | "products" | "debt" | "profit";
export type PartyConfig = {
  page: string; noun: string; groupBy: "CUSTOMER" | "SELLER" | "CHANNEL"; productsBy?: "CUSTOMER" | "SELLER";
  concerns: [PartyConcern, string][]; titles: Partial<Record<PartyConcern, string>>; chartTitle: string; pie?: boolean;
  firstCol: string; codeCol?: string; filters: ("customer" | "seller" | "channel")[]; note?: string;
};

const debtMoney = (key: keyof DebtRow, label: string): ReportColumn<DebtRow> => ({ key, label, type: "money", value: (r) => r[key] as number });
export const DEBT_COLUMNS = (codeLabel: string, nameLabel: string): ReportColumn<DebtRow>[] => [
  { key: "code", label: codeLabel, value: (r) => r.code, render: (r) => <b className="rp-link">{r.code}</b> },
  { key: "name", label: nameLabel, value: (r) => r.name }, debtMoney("opening", "Nợ đầu kỳ"), debtMoney("debit", "Ghi nợ"),
  debtMoney("credit", "Ghi có"), debtMoney("closing", "Nợ cuối kỳ"),
];
export function debtLines(rows: DebtRow[], label: string): ReportLine<DebtRow>[] {
  if (!rows.length) return [];
  const s = (k: "opening" | "debit" | "credit" | "closing") => rows.reduce((a, r) => a + Number(r[k]), 0);
  return [{ id: "sum", kind: "sum", label, data: { code: "", name: "", phone: null, opening: s("opening"), debit: s("debit"), credit: s("credit"), closing: s("closing") } },
    ...rows.map((r, i) => ({ id: `${r.code}-${i}`, kind: "row" as const, data: r }))];
}

/** Báo cáo theo đối tượng bán hàng (khách hàng / nhân viên / kênh bán): biểu đồ Top 10 hoặc tròn, báo cáo theo mối quan tâm. */
export function PartyReport({ cfg }: { cfg: PartyConfig }) {
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
  const params = { branchIds: branch || undefined, customerId: customer?.id, sellerId: seller || undefined };
  const sumQ = useReport<SummaryRow[]>("/reports/sales/summary", span, { ...params, groupBy: cfg.groupBy }, concern === "sales" || concern === "profit");
  const prodQ = useReport<ProductRow[]>("/reports/sales/products", span, { ...params, by: cfg.productsBy }, concern === "products");
  const debtQ = useReport<DebtRow[]>("/reports/customers/debt", span, { customerId: customer?.id }, concern === "debt");
  const rows = sumQ.data ?? [];
  const sumLabel = `SL ${cfg.noun}: ${rows.length}`;
  const prodRows = (prodQ.data ?? []).map(fromSales).sort((a, b) => a.dim.localeCompare(b.dim) || b.net - a.net);
  const table = concern === "sales" ? asTable(revenueColumns(cfg.firstCol, cfg.codeCol), summaryLines(rows, sumLabel))
    : concern === "profit" ? asTable(profitColumns(cfg.firstCol, cfg.codeCol), summaryLines(rows, sumLabel))
      : concern === "products" ? asTable(COLUMNS[cfg.productsBy === "SELLER" ? "seller" : "customer"], withTotal(prodRows, `SL ${cfg.noun}: ${new Set(prodRows.map((r) => r.dim)).size}`))
        : asTable(DEBT_COLUMNS("Mã khách hàng", "Tên khách hàng"), debtLines(debtQ.data ?? [], `SL khách hàng: ${(debtQ.data ?? []).length}`));
  const active = concern === "products" ? prodQ : concern === "debt" ? debtQ : sumQ;
  const exportCsv = () => { const t = linesToCsv(table.columns, table.lines); downloadCsv(`${cfg.page}-${concern}-${ymd(range.from)}.csv`, t.header, t.rows); };

  const chart = () => {
    const items = concern === "debt" ? (debtQ.data ?? []).map((d) => ({ label: d.name, value: Number(d.closing) }))
      : concern === "products" ? prodRows.map((r) => ({ label: `${r.dim} - ${r.name}`, value: r.net }))
        : rows.map((r) => ({ label: r.name, value: concern === "profit" ? Number(r.revenue) - Number(r.returnValue) - Number(r.cogs) : Number(r.revenue) - Number(r.returnValue) }));
    const title = concern === "debt" ? "Top 10 khách hàng nợ nhiều nhất" : concern === "profit" ? `Top 10 ${cfg.noun} mang lại lợi nhuận cao nhất`
      : concern === "products" ? `Top 10 ${cfg.noun} theo hàng bán (doanh thu thuần)` : cfg.chartTitle;
    return (
      <ChartCard title={title}>
        {cfg.pie && concern === "sales" ? <PieChart items={items} /> : top10(items).length ? <BarChart items={top10(items)} /> : <EmptyChart />}
      </ChartCard>);
  };

  return (
    <ReportLayout title={`Báo cáo ${cfg.page === "bao-cao-kenh-ban" ? "kênh bán hàng" : cfg.noun}`} sidebar={<>
      <ViewModeFilter value={mode} onChange={setMode} />
      <SelectFilter title="Mối quan tâm" value={concern} onChange={(v) => setConcern(v as PartyConcern)} options={cfg.concerns} />
      <BranchFilter value={branch} onChange={setBranch} />
      <TimeFilter value={time} onChange={setTime} />
      {cfg.filters.includes("customer") && <CustomerFilter value={customer} onChange={setCustomer} />}
      {cfg.filters.includes("seller") && <SelectFilter title="Người bán" value={seller} onChange={setSeller} placeholder="Chọn người bán" options={users.map((u) => [u.id, u.fullName] as const)} />}
      {cfg.filters.includes("channel") && <SelectFilter title="Kênh bán" value={channel} onChange={setChannel} placeholder="Chọn kênh bán" options={[["DIRECT", "Bán trực tiếp"]]}
        hint="Mọi hóa đơn hiện bán tại cửa hàng (Bán trực tiếp)" />}
    </>}>
      {mode === "chart" ? chart() : (
        <ReportViewer title={cfg.titles[concern] ?? ""} meta={[rangeText(range), concern === "debt" ? "Chi nhánh: Tất cả (sổ công nợ theo khách)" : `Chi nhánh: ${branchLabel}`]}
          note={concern === "products" ? "(Đã phân bổ giảm giá hóa đơn, giảm giá phiếu trả)" : cfg.note}
          landscape={concern === "profit" || concern === "products"} loading={active.isFetching} onRefresh={() => active.refetch()}
          onExport={table.lines.length ? exportCsv : undefined}>
          {active.isError ? <p className="rp-empty">Không tải được báo cáo</p> : <ReportTable columns={table.columns} lines={table.lines} />}
        </ReportViewer>)}
    </ReportLayout>
  );
}
