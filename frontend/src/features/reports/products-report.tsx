"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileOutput } from "lucide-react";
import { downloadCsv } from "@/features/accounting/tax-calc";
import { ymd } from "@/features/dashboard/dashboard-date-utils";
import { useCategories } from "@/features/products/product-queries";
import { api } from "@/lib/api-client";
import { COLUMNS, fromDamage, fromMovements, fromSales, fromStock, fromSupplier, groupByCategory, withTotal, type PAgg, type StockLine } from "./products-report-tables";
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
const CONCERNS: [Concern, string][] = [["sales", "Bán hàng"], ["profit", "Lợi nhuận"], ["stock", "Xuất nhập tồn"], ["stockDetail", "Xuất nhập tồn chi tiết"],
  ["damage", "Xuất hủy"], ["seller", "Nhân viên theo hàng bán"], ["customer", "Khách theo hàng bán"], ["supplier", "NCC theo hàng nhập"]];
const TITLES: Record<Concern, string> = {
  sales: "Báo cáo bán hàng theo hàng hóa", profit: "Báo cáo lợi nhuận theo hàng hóa", stock: "Báo cáo xuất nhập tồn",
  stockDetail: "Báo cáo xuất nhập tồn chi tiết", damage: "Báo cáo xuất hủy hàng hóa", seller: "Báo cáo nhân viên theo hàng bán",
  customer: "Báo cáo khách hàng theo hàng bán", supplier: "Báo cáo nhà cung cấp theo hàng nhập",
};
const SALES_BY: Partial<Record<Concern, string>> = { sales: "NONE", profit: "NONE", seller: "SELLER", customer: "CUSTOMER" };

/** Báo cáo hàng hóa: biểu đồ Top 10 / báo cáo theo 8 mối quan tâm; lọc hàng, nhóm hàng; gộp hàng cùng loại / theo nhóm hàng. */
export function ProductsReport() {
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
  let lines = withTotal(rows, `SL mặt hàng: ${new Set(rows.map((r) => r.code)).size}`);
  if (byGroup) lines = groupByCategory(lines, (r) => categories.find((c) => c.id === catOf.get(pidOf.get(r) ?? ""))?.name ?? "Chưa phân nhóm");
  const columns = COLUMNS[concern];
  const exportCsv = () => { const t = linesToCsv(columns, lines); downloadCsv(`bao-cao-hang-hoa-${concern}-${ymd(range.from)}.csv`, t.header, t.rows); };

  const chart = () => {
    const item = (r: PAgg, v: number) => ({ label: r.dim && concern !== "sales" ? `${r.name} - ${r.dim}` : r.name, value: v });
    const charts: [string, { label: string; value: number }[]][] = concern === "sales" ? [
      ["Top 10 sản phẩm doanh thu cao nhất (đã trừ trả hàng)", top10(rows.map((r) => item(r, r.v.net)))],
      ["Top 10 sản phẩm bán chạy theo số lượng (đã trừ trả hàng)", top10(rows.map((r) => item(r, r.v.qtySold - r.v.qtyReturned)))]]
      : concern === "profit" ? [["Top 10 sản phẩm lợi nhuận cao nhất", top10(rows.map((r) => item(r, r.v.profit)))]]
        : concern === "stock" ? [["Top 10 sản phẩm giá trị tồn kho cao nhất", top10(rows.map((r) => item(r, r.v.cv)))]]
          : concern === "stockDetail" ? [["Top 10 sản phẩm xuất bán nhiều nhất", top10(rows.map((r) => item(r, r.v.sale)))]]
            : concern === "damage" ? [["Top 10 sản phẩm xuất hủy nhiều nhất (giá trị)", top10(rows.map((r) => item(r, r.v.value)))]]
              : concern === "supplier" ? [["Top 10 sản phẩm nhập nhiều nhất (đã trừ trả hàng)", top10(rows.map((r) => item(r, r.v.net)))]]
                : [[`Top 10 ${concern === "seller" ? "nhân viên" : "khách hàng"} theo hàng bán (doanh thu thuần)`, top10(rows.map((r) => item(r, r.v.net)))]];
    return charts.map(([title, items], i) => (
      <ChartCard key={title} title={title}>{items.length ? <BarChart items={items} money={!(concern === "sales" && i === 1) && concern !== "stockDetail"} /> : <EmptyChart />}</ChartCard>));
  };

  return (
    <ReportLayout title="Báo cáo hàng hóa" sidebar={<>
      {mode === "report" && (
        <button type="button" onClick={exportCsv} disabled={!lines.length}
          className="flex h-[30px] w-full items-center justify-center gap-1.5 rounded-md border text-[13px] hover:border-primary disabled:opacity-50">
          <FileOutput className="size-4" /> Xuất tất cả</button>)}
      <ViewModeFilter value={mode} onChange={setMode} />
      {salesBy && <CheckFilter checked={merge} onChange={setMerge}>Gộp hàng hóa cùng loại</CheckFilter>}
      {mode === "report" && <CheckFilter checked={byGroup} onChange={setByGroup}>Gộp theo nhóm hàng</CheckFilter>}
      <SelectFilter title="Mối quan tâm" value={concern} onChange={(v) => setConcern(v as Concern)} options={CONCERNS} />
      <BranchFilter value={branch} onChange={setBranch} />
      <SelectFilter title="Bảng giá" value={priceBook} onChange={setPriceBook} placeholder="Chọn bảng giá" options={priceBooks}
        disabled={!salesBy} hint={salesBy ? undefined : "Chỉ áp dụng cho báo cáo bán hàng theo hàng hóa"} />
      <TimeFilter value={time} onChange={setTime} />
      <TextFilter title="Hàng hóa" value={q} onChange={setQ} placeholder="Theo mã, tên hàng" />
      <SelectFilter title="Nhóm hàng" value={category} onChange={setCategory} placeholder="Chọn nhóm hàng" options={categories.map((c) => [c.id, c.name] as const)} />
    </>}>
      {mode === "chart" ? chart() : (
        <ReportViewer title={TITLES[concern]} meta={[rangeText(range), `Chi nhánh: ${branchLabel}`, ...(salesBy ? [`Bảng giá: ${priceBooks.find(([v]) => v === priceBook)?.[1] ?? "Tất cả"}`] : [])]}
          note={salesBy ? "(Đã phân bổ giảm giá hóa đơn, giảm giá phiếu trả)" : undefined} landscape={!["sales", "damage"].includes(concern)}
          loading={active.isFetching} onRefresh={() => active.refetch()} onExport={lines.length ? exportCsv : undefined}>
          {active.isError ? <p className="rp-empty">Không tải được báo cáo</p> : <ReportTable columns={columns} lines={lines} />}
        </ReportViewer>)}
    </ReportLayout>
  );
}
