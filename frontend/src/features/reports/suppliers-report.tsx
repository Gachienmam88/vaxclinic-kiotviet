"use client";

import { useState } from "react";
import { downloadCsv } from "@/features/accounting/tax-calc";
import { ymd } from "@/features/dashboard/dashboard-date-utils";
import { debtLines, DEBT_COLUMNS } from "./party-report";
import { BarChart, ChartCard, EmptyChart } from "./report-charts";
import { spanOf, sumOf, useReport, type DebtRow, type SupplierRow } from "./report-api";
import { BranchFilter, ReportLayout, SelectFilter, TextFilter, useBranchLabel, ViewModeFilter, type ViewMode } from "./report-sidebar-kit";
import { asTable, linesToCsv, ReportTable, type ReportColumn, type ReportLine } from "./report-table";
import { TimeFilter } from "./report-time-filter";
import { rangeText, timeRange, type TimeValue } from "./report-time-presets";
import { ReportViewer } from "./report-viewer";
import { top10 } from "./summary-table-kit";
import { DocCodeLink } from "@/components/ui/doc-code-link";

type Concern = "purchase" | "products" | "debt";
const CONCERNS: [Concern, string][] = [["purchase", "Nhập hàng"], ["products", "Hàng nhập theo NCC"], ["debt", "Công nợ"]];
const TITLES: Record<Concern, string> = { purchase: "Báo cáo nhập hàng theo nhà cung cấp", products: "Báo cáo hàng nhập theo nhà cung cấp", debt: "Báo cáo công nợ nhà cung cấp" };

type SAgg = { code: string; name: string; product: string; productCode: string; qtyIn: number; valueIn: number; qtyReturned: number; valueReturned: number; net: number };
const toAgg = (s: SupplierRow): SAgg => ({ code: s.supplierCode ?? "", name: s.supplierName, product: s.productName ? `${s.productCode} - ${s.productName}` : "", productCode: s.productCode ?? "",
  qtyIn: +s.qtyIn, valueIn: +s.valueIn, qtyReturned: +s.qtyReturned, valueReturned: +s.valueReturned, net: +s.valueIn - +s.valueReturned });
const m = (key: keyof SAgg, label: string, type: "money" | "qty" = "money"): ReportColumn<SAgg> => ({ key, label, type, value: (r) => r[key] });
const CODE: ReportColumn<SAgg> = { key: "code", label: "Mã NCC", value: (r) => r.code, render: (r) => <b><DocCodeLink code={r.code} /></b> };
const NAME: ReportColumn<SAgg> = { key: "name", label: "Tên NCC", value: (r) => r.name };
const PURCHASE_COLS = [CODE, NAME, m("valueIn", "Giá trị nhập"), m("valueReturned", "Giá trị trả"), m("net", "Giá trị nhập thuần")];
const PRODUCT_COLS = [CODE, NAME, { key: "product", label: "Hàng hóa", value: (r: SAgg) => r.product,
  render: (r: SAgg) => (r.productCode ? <><DocCodeLink code={r.productCode} />{r.product.slice(r.productCode.length)}</> : r.product) }, m("qtyIn", "SL nhập", "qty"), m("valueIn", "Giá trị nhập"),
  m("qtyReturned", "SL trả", "qty"), m("valueReturned", "Giá trị trả"), m("net", "Giá trị nhập thuần")];

function lines(rows: SAgg[], label: string): ReportLine<SAgg>[] {
  if (!rows.length) return [];
  const s = (k: keyof SAgg) => sumOf(rows, (r) => r[k] as number);
  return [{ id: "sum", kind: "sum", label, data: { code: "", name: "", product: "", productCode: "", qtyIn: s("qtyIn"), valueIn: s("valueIn"), qtyReturned: s("qtyReturned"),
    valueReturned: s("valueReturned"), net: s("net") } }, ...rows.map((r, i) => ({ id: `${r.code}-${r.product}-${i}`, kind: "row" as const, data: r }))];
}

/** Báo cáo nhà cung cấp (product-service): Nhập hàng / Hàng nhập theo NCC / Công nợ; biểu đồ Top 10 NCC nhập nhiều nhất. */
export function SuppliersReport() {
  const [mode, setMode] = useState<ViewMode>("chart");
  const [concern, setConcern] = useState<Concern>("purchase");
  const [time, setTime] = useState<TimeValue>({ mode: "preset", preset: "thisWeek" });
  const [q, setQ] = useState("");
  const [branch, setBranch] = useState("");
  const branchLabel = useBranchLabel(branch);
  const range = timeRange(time), span = spanOf(range);
  const sumQ = useReport<SupplierRow[]>("/reports/suppliers/summary", span, { branchIds: branch || undefined, byProduct: concern === "products" }, concern !== "debt");
  const debtQ = useReport<DebtRow[]>("/reports/suppliers/debt", span, { branchIds: branch || undefined }, concern === "debt");
  const match = (code: string | null, name: string) => !q || `${code ?? ""} ${name}`.toLowerCase().includes(q.toLowerCase());
  const rows = (sumQ.data ?? []).filter((s) => match(s.supplierCode, s.supplierName)).map(toAgg);
  const debts = (debtQ.data ?? []).filter((d) => match(d.code, d.name));
  const table = concern === "debt" ? asTable(DEBT_COLUMNS("Mã NCC", "Tên NCC"), debtLines(debts, `SL nhà cung cấp: ${debts.length}`))
    : asTable(concern === "products" ? PRODUCT_COLS : PURCHASE_COLS, lines(rows, `SL nhà cung cấp: ${new Set(rows.map((r) => r.code + r.name)).size}`));
  const active = concern === "debt" ? debtQ : sumQ;
  const exportCsv = () => { const t = linesToCsv(table.columns, table.lines); downloadCsv(`bao-cao-ncc-${concern}-${ymd(range.from)}.csv`, t.header, t.rows); };
  const items = top10(concern === "debt" ? debts.map((d) => ({ label: d.name, value: Number(d.closing) }))
    : concern === "products" ? rows.map((r) => ({ label: `${r.name} - ${r.product}`, value: r.net })) : rows.map((r) => ({ label: r.name, value: r.net })));
  const chartTitle = concern === "debt" ? "Top 10 nhà cung cấp cửa hàng nợ nhiều nhất" : concern === "products"
    ? "Top 10 hàng hóa nhập nhiều nhất theo nhà cung cấp (đã trừ trả hàng)" : "Top 10 nhà cung cấp nhập hàng nhiều nhất (đã trừ trả hàng)";

  return (
    <ReportLayout title="Báo cáo nhà cung cấp" sidebar={<>
      <ViewModeFilter value={mode} onChange={setMode} />
      <SelectFilter title="Mối quan tâm" value={concern} onChange={(v) => setConcern(v as Concern)} options={CONCERNS} />
      <BranchFilter value={branch} onChange={setBranch} />
      <TimeFilter value={time} onChange={setTime} />
      <TextFilter title="Nhà cung cấp" value={q} onChange={setQ} placeholder="Theo mã, tên nhà cung cấp" />
    </>}>
      {mode === "chart" ? <ChartCard title={chartTitle}>{items.length ? <BarChart items={items} /> : <EmptyChart />}</ChartCard> : (
        <ReportViewer title={TITLES[concern]} meta={[rangeText(range), `Chi nhánh: ${branchLabel}`]} landscape={concern === "products"}
          note={concern === "debt" ? "(Công nợ theo phiếu nhập / trả hàng nhập đã hoàn thành)" : "(Giá trị theo tổng phiếu: sau giảm giá, gồm VAT)"}
          loading={active.isFetching} onRefresh={() => active.refetch()} onExport={table.lines.length ? exportCsv : undefined}>
          {active.isError ? <p className="rp-empty">Không tải được báo cáo</p> : <ReportTable columns={table.columns} lines={table.lines} />}
        </ReportViewer>)}
    </ReportLayout>
  );
}
