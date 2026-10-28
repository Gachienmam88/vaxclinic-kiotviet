"use client";

import { useState } from "react";
import { downloadCsv } from "@/features/accounting/tax-calc";
import { ymd } from "@/features/dashboard/dashboard-date-utils";
import { useT } from "@/lib/i18n";
import { reportsNs, type ReportsT } from "@/messages/reports";
import { debtColumns, debtLines } from "./party-report";
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
/** Mối quan tâm; nhãn "suppliers.concerns.<…>", tiêu đề "suppliers.titles.<…>", biểu đồ "suppliers.charts.<…>". */
const CONCERNS: Concern[] = ["purchase", "products", "debt"];

type SAgg = { code: string; name: string; product: string; productCode: string; qtyIn: number; valueIn: number; qtyReturned: number; valueReturned: number; net: number };
const toAgg = (s: SupplierRow): SAgg => ({ code: s.supplierCode ?? "", name: s.supplierName, product: s.productName ? `${s.productCode} - ${s.productName}` : "", productCode: s.productCode ?? "",
  qtyIn: +s.qtyIn, valueIn: +s.valueIn, qtyReturned: +s.qtyReturned, valueReturned: +s.valueReturned, net: +s.valueIn - +s.valueReturned });
const m = (key: keyof SAgg, label: string, type: "money" | "qty" = "money"): ReportColumn<SAgg> => ({ key, label, type, value: (r) => r[key] });
/** Cột theo mối quan tâm (nhãn theo ngôn ngữ). */
function supplierColumns(t: ReportsT, byProduct: boolean): ReportColumn<SAgg>[] {
  const code: ReportColumn<SAgg> = { key: "code", label: t("cols.supplierCode"), value: (r) => r.code, render: (r) => <b><DocCodeLink code={r.code} /></b> };
  const name: ReportColumn<SAgg> = { key: "name", label: t("cols.supplierName"), value: (r) => r.name };
  if (!byProduct) return [code, name, m("valueIn", t("cols.valueIn")), m("valueReturned", t("cols.returnValue")), m("net", t("cols.netIn"))];
  return [code, name, { key: "product", label: t("cols.product"), value: (r) => r.product,
    render: (r) => (r.productCode ? <><DocCodeLink code={r.productCode} />{r.product.slice(r.productCode.length)}</> : r.product) },
  m("qtyIn", t("cols.qtyIn"), "qty"), m("valueIn", t("cols.valueIn")), m("qtyReturned", t("cols.qtyReturned"), "qty"),
  m("valueReturned", t("cols.returnValue")), m("net", t("cols.netIn"))];
}

function lines(rows: SAgg[], label: string): ReportLine<SAgg>[] {
  if (!rows.length) return [];
  const s = (k: keyof SAgg) => sumOf(rows, (r) => r[k] as number);
  return [{ id: "sum", kind: "sum", label, data: { code: "", name: "", product: "", productCode: "", qtyIn: s("qtyIn"), valueIn: s("valueIn"), qtyReturned: s("qtyReturned"),
    valueReturned: s("valueReturned"), net: s("net") } }, ...rows.map((r, i) => ({ id: `${r.code}-${r.product}-${i}`, kind: "row" as const, data: r }))];
}

/** Báo cáo nhà cung cấp (product-service): Nhập hàng / Hàng nhập theo NCC / Công nợ; biểu đồ Top 10 NCC nhập nhiều nhất. */
export function SuppliersReport() {
  const t = useT(reportsNs);
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
  const table = concern === "debt" ? asTable(debtColumns(t, t("cols.supplierCode"), t("cols.supplierName")), debtLines(debts, t("suppliers.supplierCount", { n: debts.length })))
    : asTable(supplierColumns(t, concern === "products"), lines(rows, t("suppliers.supplierCount", { n: new Set(rows.map((r) => r.code + r.name)).size })));
  const active = concern === "debt" ? debtQ : sumQ;
  const exportCsv = () => { const csv = linesToCsv(table.columns, table.lines); downloadCsv(`bao-cao-ncc-${concern}-${ymd(range.from)}.csv`, csv.header, csv.rows); };
  const items = top10(concern === "debt" ? debts.map((d) => ({ label: d.name, value: Number(d.closing) }))
    : concern === "products" ? rows.map((r) => ({ label: `${r.name} - ${r.product}`, value: r.net })) : rows.map((r) => ({ label: r.name, value: r.net })));
  const chartTitle = t(`suppliers.charts.${concern}`);

  return (
    <ReportLayout title={t("suppliers.title")} sidebar={<>
      <ViewModeFilter value={mode} onChange={setMode} />
      <SelectFilter title={t("filters.concern")} value={concern} onChange={(v) => setConcern(v as Concern)}
        options={CONCERNS.map((c) => [c, t(`suppliers.concerns.${c}`)] as const)} />
      <BranchFilter value={branch} onChange={setBranch} />
      <TimeFilter value={time} onChange={setTime} />
      <TextFilter title={t("suppliers.filter")} value={q} onChange={setQ} placeholder={t("suppliers.filterPlaceholder")} />
    </>}>
      {mode === "chart" ? <ChartCard title={chartTitle}>{items.length ? <BarChart items={items} /> : <EmptyChart />}</ChartCard> : (
        <ReportViewer title={t(`suppliers.titles.${concern}`)} meta={[rangeText(t, range), t("common.branchMeta", { branch: branchLabel })]} landscape={concern === "products"}
          note={concern === "debt" ? t("suppliers.noteDebt") : t("suppliers.noteValue")}
          loading={active.isFetching} onRefresh={() => active.refetch()} onExport={table.lines.length ? exportCsv : undefined}>
          {active.isError ? <p className="rp-empty">{t("common.loadError")}</p> : <ReportTable columns={table.columns} lines={table.lines} />}
        </ReportViewer>)}
    </ReportLayout>
  );
}
