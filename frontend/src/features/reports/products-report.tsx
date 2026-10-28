"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileOutput } from "lucide-react";
import { downloadCsv } from "@/features/accounting/tax-calc";
import { ymd } from "@/features/dashboard/dashboard-date-utils";
import { useCategories } from "@/features/products/product-queries";
import { api } from "@/lib/api-client";
import { useT } from "@/lib/i18n";
import { reportsNs } from "@/messages/reports";
import { fromDamage, fromMovements, fromSales, fromStock, fromSupplier, groupByCategory, productColumns, withTotal, type PAgg, type StockLine } from "./products-report-tables";
import { BarChart, ChartCard, EmptyChart } from "./report-charts";
import { usePriceBookOptions } from "./report-filter-options";
import { spanOf, useReport, type DamageRow, type MovementRow, type ProductRow, type SupplierRow } from "./report-api";
import { BranchFilter, CheckFilter, ReportLayout, SelectFilter, TextFilter, useBranchLabel, ViewModeFilter, type ViewMode } from "./report-sidebar-kit";
import { linesToCsv, ReportTable } from "./report-table";
import { TimeFilter } from "./report-time-filter";
import { rangeText, timeRange, type TimeValue } from "./report-time-presets";
import { ReportViewer } from "./report-viewer";
import { top10 } from "./summary-table-kit";

type Concern = "sales" | "profit" | "stock" | "stockDetail" | "damage" | "seller" | "customer" | "supplier";
/** Mối quan tâm; nhãn "products.concerns.<…>", tiêu đề tờ báo cáo "products.titles.<…>". */
const CONCERNS: Concern[] = ["sales", "profit", "stock", "stockDetail", "damage", "seller", "customer", "supplier"];
const SALES_BY: Partial<Record<Concern, string>> = { sales: "NONE", profit: "NONE", seller: "SELLER", customer: "CUSTOMER" };

/** Báo cáo hàng hóa: biểu đồ Top 10 / báo cáo theo 8 mối quan tâm; lọc hàng, nhóm hàng; gộp hàng cùng loại / theo nhóm hàng. */
export function ProductsReport() {
  const t = useT(reportsNs);
  const [mode, setMode] = useState<ViewMode>("chart");
  const [concern, setConcern] = useState<Concern>("sales");
  const [time, setTime] = useState<TimeValue>({ mode: "preset", preset: "thisWeek" });
  const [merge, setMerge] = useState(false);
  const [byGroup, setByGroup] = useState(false);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [branch, setBranch] = useState("");
  const [priceBook, setPriceBook] = useState("");
  const priceBooks = usePriceBookOptions();
  const branchLabel = useBranchLabel(branch);
  const range = timeRange(time), span = spanOf(range);
  const salesBy = SALES_BY[concern];
  const salesQ = useReport<ProductRow[]>("/reports/sales/products", span, { branchIds: branch || undefined, by: salesBy, merge, q, priceBookIds: priceBook || undefined }, !!salesBy);
  const stockQ = useQuery({ queryKey: ["report", "stock-summary", ymd(range.from), ymd(range.to), branch], enabled: concern === "stock",
    queryFn: () => api<StockLine[]>(`/accounting/stock/summary?from=${ymd(range.from)}&to=${ymd(range.to)}${branch ? `&branchIds=${branch}` : ""}`) });
  const moveQ = useReport<MovementRow[]>("/reports/inventory/movement-detail", span, { branchIds: branch || undefined }, concern === "stockDetail");
  const damageQ = useReport<DamageRow[]>("/reports/inventory/damages", span, { branchIds: branch || undefined }, concern === "damage");
  const supQ = useReport<SupplierRow[]>("/reports/suppliers/summary", span, { branchIds: branch || undefined, byProduct: true }, concern === "supplier");
  const { data: categories = [] } = useCategories();
  const { data: productCats = [] } = useQuery({ queryKey: ["product-categories"],
    queryFn: () => api<{ productId: string; categoryId: string | null }[]>("/accounting/stock/product-categories") });
  const catOf = new Map(productCats.map((p) => [p.productId, p.categoryId]));
  // Nhóm đang lọc gồm cả nhóm con
  const inCategory = (pid: string | null | undefined) => {
    if (!category) return true;
    for (let c = pid ? catOf.get(pid) ?? null : null; c; c = categories.find((x) => x.id === c)?.parentId ?? null) if (c === category) return true;
    return false;
  };
  const textOk = (code: string, name: string) => !q || `${code} ${name}`.toLowerCase().includes(q.toLowerCase());

  const active = salesBy ? salesQ : concern === "stock" ? stockQ : concern === "stockDetail" ? moveQ : concern === "damage" ? damageQ : supQ;
  const withPid: { pid: string | null; row: PAgg }[] = salesBy ? (salesQ.data ?? []).map((r) => ({ pid: r.productId, row: fromSales(r) }))
    : concern === "stock" ? (stockQ.data ?? []).map((s) => ({ pid: s.productId, row: fromStock(s) }))
      : concern === "stockDetail" ? fromMovements(moveQ.data ?? []).map((r) => ({ pid: r.productId, row: r }))
        : concern === "damage" ? (damageQ.data ?? []).map((d) => ({ pid: d.productId, row: fromDamage(d) }))
          : (supQ.data ?? []).map((s) => ({ pid: s.productId, row: fromSupplier(s) }));
  const filtered = withPid.filter((x) => inCategory(x.pid) && (salesBy || textOk(x.row.code, x.row.name)));
  const rows = filtered.map((x) => x.row);
  const pidOf = new Map(filtered.map((x) => [x.row, x.pid]));
  let lines = withTotal(rows, t("common.itemCount", { n: new Set(rows.map((r) => r.code)).size }));
  if (byGroup) lines = groupByCategory(lines, (r) => categories.find((c) => c.id === catOf.get(pidOf.get(r) ?? ""))?.name ?? t("products.uncategorized"));
  const columns = productColumns(t)[concern];
  const exportCsv = () => { const csv = linesToCsv(columns, lines); downloadCsv(`bao-cao-hang-hoa-${concern}-${ymd(range.from)}.csv`, csv.header, csv.rows); };

  const chart = () => {
    const item = (r: PAgg, v: number) => ({ label: r.dim && concern !== "sales" ? `${r.name} - ${r.dim}` : r.name, value: v });
    const charts: [string, { label: string; value: number }[]][] = concern === "sales" ? [
      [t("products.charts.salesRevenue"), top10(rows.map((r) => item(r, r.v.net)))],
      [t("products.charts.salesQty"), top10(rows.map((r) => item(r, r.v.qtySold - r.v.qtyReturned)))]]
      : concern === "profit" ? [[t("products.charts.profit"), top10(rows.map((r) => item(r, r.v.profit)))]]
        : concern === "stock" ? [[t("products.charts.stock"), top10(rows.map((r) => item(r, r.v.cv)))]]
          : concern === "stockDetail" ? [[t("products.charts.stockDetail"), top10(rows.map((r) => item(r, r.v.sale)))]]
            : concern === "damage" ? [[t("products.charts.damage"), top10(rows.map((r) => item(r, r.v.value)))]]
              : concern === "supplier" ? [[t("products.charts.supplier"), top10(rows.map((r) => item(r, r.v.net)))]]
                : [[t(concern === "seller" ? "products.charts.seller" : "products.charts.customer"), top10(rows.map((r) => item(r, r.v.net)))]];
    return charts.map(([title, items], i) => (
      <ChartCard key={title} title={title}>{items.length ? <BarChart items={items} money={!(concern === "sales" && i === 1) && concern !== "stockDetail"} /> : <EmptyChart />}</ChartCard>));
  };

  return (
    <ReportLayout title={t("products.title")} sidebar={<>
      {mode === "report" && (
        <button type="button" onClick={exportCsv} disabled={!lines.length}
          className="flex h-[30px] w-full items-center justify-center gap-1.5 rounded-md border text-[13px] hover:border-primary disabled:opacity-50">
          <FileOutput className="size-4" /> {t("filters.exportAll")}</button>)}
      <ViewModeFilter value={mode} onChange={setMode} />
      {salesBy && <CheckFilter checked={merge} onChange={setMerge}>{t("filters.mergeSameProducts")}</CheckFilter>}
      {mode === "report" && <CheckFilter checked={byGroup} onChange={setByGroup}>{t("filters.mergeByCategory")}</CheckFilter>}
      <SelectFilter title={t("filters.concern")} value={concern} onChange={(v) => setConcern(v as Concern)}
        options={CONCERNS.map((c) => [c, t(`products.concerns.${c}`)] as const)} />
      <BranchFilter value={branch} onChange={setBranch} />
      <SelectFilter title={t("filters.priceBook")} value={priceBook} onChange={setPriceBook} placeholder={t("filters.pickPriceBook")} options={priceBooks}
        disabled={!salesBy} hint={salesBy ? undefined : t("products.priceBookHint")} />
      <TimeFilter value={time} onChange={setTime} />
      <TextFilter title={t("filters.product")} value={q} onChange={setQ} placeholder={t("filters.productPlaceholder")} />
      <SelectFilter title={t("filters.category")} value={category} onChange={setCategory} placeholder={t("filters.pickCategory")} options={categories.map((c) => [c.id, c.name] as const)} />
    </>}>
      {mode === "chart" ? chart() : (
        <ReportViewer title={t(`products.titles.${concern}`)} meta={[rangeText(t, range), t("common.branchMeta", { branch: branchLabel }),
          ...(salesBy ? [t("common.priceBookMeta", { name: priceBooks.find(([v]) => v === priceBook)?.[1] ?? t("common.all") })] : [])]}
          note={salesBy ? t("common.allocatedDiscount") : undefined} landscape={!["sales", "damage"].includes(concern)}
          loading={active.isFetching} onRefresh={() => active.refetch()} onExport={lines.length ? exportCsv : undefined}>
          {active.isError ? <p className="rp-empty">{t("common.loadError")}</p> : <ReportTable columns={columns} lines={lines} />}
        </ReportViewer>)}
    </ReportLayout>
  );
}
