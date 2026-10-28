/**
 * Bảng của Báo cáo hàng hóa: Bán hàng, Lợi nhuận, theo nhân viên / khách (sales-service); Xuất nhập tồn, XNT chi tiết,
 * Xuất hủy, NCC theo hàng nhập (product-service). Mỗi hàm trả về dòng tổng + các dòng; withGroups: chèn dòng nhóm hàng.
 */
import { sumOf, type DamageRow, type MovementRow, type ProductRow, type SupplierRow } from "./report-api";
import type { ReportColumn, ReportLine } from "./report-table";
import { DocCodeLink, docCodeHref } from "@/components/ui/doc-code-link";

/** 1 dòng chung cho mọi bảng hàng hóa (các trường không dùng = 0). */
export type PAgg = { code: string; name: string; dim: string; v: Record<string, number> };
type Num = Record<string, number>;

const agg = (code: string, name: string, dim: string, nums: Num): PAgg => ({ code, name, dim, v: nums });

const NUMERIC = ["qtySold", "revenue", "qtyReturned", "returnValue", "net", "cogs", "profit", "margin",
  "oq", "ov", "iq", "iv", "xq", "xv", "cq", "cv", "before", "purchase", "custReturn", "adjust", "otherIn", "sale", "supReturn", "damage", "internal", "otherOut", "closing", "closingValue", "qty", "value", "docs"];

/** Dòng tổng: cộng mọi cột số (tỷ suất tính lại từ tổng). */
export function withTotal(rows: PAgg[], label: string): ReportLine<PAgg>[] {
  if (!rows.length) return [];
  const t = agg("", "", "", Object.fromEntries(NUMERIC.map((k) => [k, sumOf(rows, (r) => r.v[k] ?? 0)])));
  t.v.margin = t.v.net ? Math.round((t.v.profit / t.v.net) * 10000) / 100 : 0;
  return [{ id: "sum", kind: "sum", label, data: t }, ...rows.map((r, i) => ({ id: `${r.code}-${r.dim}-${i}`, kind: "row" as const, data: r }))];
}

/** Chèn dòng nhóm hàng (Gộp theo nhóm hàng) trước các dòng của nhóm; groupOf(code) → tên nhóm. */
export function groupByCategory(lines: ReportLine<PAgg>[], groupOf: (r: PAgg) => string): ReportLine<PAgg>[] {
  const [sum, ...rest] = lines;
  if (!sum) return lines;
  const groups = new Map<string, ReportLine<PAgg>[]>();
  rest.forEach((l) => { const g = groupOf(l.data); groups.set(g, [...(groups.get(g) ?? []), l]); });
  return [sum, ...[...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).flatMap(([g, ls]) => {
    const t = withTotal(ls.map((l) => l.data), g)[0];
    return [{ ...t, id: `g-${g}`, kind: "group" as const }, ...ls.map((l) => ({ ...l, level: 1 as const }))];
  })];
}

export const fromSales = (r: ProductRow): PAgg => {
  const net = Number(r.revenue) - Number(r.returnValue), profit = net - Number(r.cogs);
  return agg(r.code, r.unit ? `${r.name} (${r.unit})` : r.name, r.dimName, { qtySold: Number(r.qtySold), revenue: Number(r.revenue),
    qtyReturned: Number(r.qtyReturned), returnValue: Number(r.returnValue), net, cogs: Number(r.cogs), profit,
    margin: net ? Math.round((profit / net) * 10000) / 100 : 0 });
};

/** Sổ S2d: tồn đầu / nhập / xuất / tồn cuối (đơn vị cơ bản). */
export type StockLine = { productId: string; productCode: string; productName: string; unitName: string; openingQty: number; openingValue: number;
  inQty: number; inValue: number; outQty: number; outValue: number; closingQty: number; closingValue: number };
export const fromStock = (s: StockLine): PAgg => agg(s.productCode, s.productName, "", {
  oq: +s.openingQty, ov: +s.openingValue, iq: +s.inQty, iv: +s.inValue, xq: +s.outQty, xv: +s.outValue, cq: +s.closingQty, cv: +s.closingValue });

/** Thẻ kho theo loại chứng từ → cột XNT chi tiết (xuất ghi số dương). */
const BUCKET: Record<string, [string, number]> = {
  BEFORE: ["before", 1], PURCHASE: ["purchase", 1], PURCHASE_CANCEL: ["purchase", 1], SALE_RETURN: ["custReturn", 1], SALE_RETURN_CANCEL_OUT: ["custReturn", 1],
  ADJUSTMENT: ["adjust", 1], OPENING: ["otherIn", 1], TRANSFER_IN: ["otherIn", 1], SALE: ["sale", -1], SALE_CANCEL: ["sale", -1],
  PURCHASE_RETURN: ["supReturn", -1], PURCHASE_RETURN_CANCEL: ["supReturn", -1], DAMAGE: ["damage", -1], DAMAGE_CANCEL: ["damage", -1],
  INTERNAL_USE: ["internal", -1], INTERNAL_USE_CANCEL: ["internal", -1], TRANSFER_OUT: ["otherOut", -1],
};
export function fromMovements(rows: MovementRow[]): (PAgg & { productId: string })[] {
  const map = new Map<string, PAgg & { productId: string }>();
  rows.forEach((m) => {
    const a = map.get(m.productId) ?? { ...agg(m.code, m.name, "", { closing: 0, closingValue: 0 }), productId: m.productId };
    const [col, sign] = BUCKET[m.docType] ?? [Number(m.qty) >= 0 ? "otherIn" : "otherOut", Number(m.qty) >= 0 ? 1 : -1];
    a.v[col] = (a.v[col] ?? 0) + sign * Number(m.qty);
    a.v.closing += Number(m.qty);
    a.v.closingValue += Number(m.value);
    map.set(m.productId, a);
  });
  return [...map.values()];
}

export const fromDamage = (d: DamageRow): PAgg => agg(d.code, d.name, "", { qty: +d.qty, value: +d.value, docs: +d.docCount });
export const fromSupplier = (s: SupplierRow): PAgg => agg(s.productCode ?? "", s.productName ?? "", `${s.supplierCode ? `${s.supplierCode} - ` : ""}${s.supplierName}`,
  { qtySold: +s.qtyIn, revenue: +s.valueIn, qtyReturned: +s.qtyReturned, returnValue: +s.valueReturned, net: +s.valueIn - +s.valueReturned });

const col = (key: string, label: string, type: "money" | "qty" = "money"): ReportColumn<PAgg> => ({ key, label, type, value: (r) => r.v[key] });
const CODE: ReportColumn<PAgg> = { key: "code", label: "Mã hàng", value: (r) => r.code, render: (r) => <b><DocCodeLink code={r.code} /></b> };
const NAME: ReportColumn<PAgg> = { key: "name", label: "Tên hàng", value: (r) => r.name, width: 140 };
/** Cột nhóm "Mã - Tên" (vd. NCC000001 - Công ty A): mã đầu thành link nếu nhận ra. */
const dimCell = (dim: string) => {
  const i = dim.indexOf(" - ");
  const code = i > 0 ? dim.slice(0, i) : "";
  return code && docCodeHref(code) ? <><DocCodeLink code={code} />{dim.slice(i)}</> : dim;
};
const DIM = (label: string): ReportColumn<PAgg> => ({ key: "dim", label, value: (r) => r.dim, width: 130, render: (r) => dimCell(r.dim) });

export const COLUMNS: Record<string, ReportColumn<PAgg>[]> = {
  sales: [CODE, NAME, col("qtySold", "SL Bán", "qty"), col("revenue", "Doanh thu"), col("qtyReturned", "SL Trả", "qty"), col("returnValue", "Giá trị trả"), col("net", "Doanh thu thuần")],
  profit: [CODE, NAME, col("qtySold", "SL Bán", "qty"), col("revenue", "Doanh thu"), col("qtyReturned", "SL Trả", "qty"), col("returnValue", "Giá trị trả"),
    col("net", "Doanh thu thuần"), col("cogs", "Tổng giá vốn"), col("profit", "Lợi nhuận"), col("margin", "Tỷ suất (%)", "qty")],
  stock: [CODE, NAME, col("oq", "Tồn đầu kỳ", "qty"), col("ov", "Giá trị đầu kỳ"), col("iq", "SL Nhập", "qty"), col("iv", "Giá trị nhập"),
    col("xq", "SL Xuất", "qty"), col("xv", "Giá trị xuất"), col("cq", "Tồn cuối kỳ", "qty"), col("cv", "Giá trị cuối kỳ")],
  stockDetail: [CODE, NAME, col("before", "Tồn đầu kỳ", "qty"), col("purchase", "Nhập NCC", "qty"), col("custReturn", "Nhập khách trả", "qty"),
    col("adjust", "Kiểm kho", "qty"), col("otherIn", "Nhập khác", "qty"), col("sale", "Xuất bán", "qty"), col("supReturn", "Xuất trả NCC", "qty"),
    col("damage", "Xuất hủy", "qty"), col("internal", "Xuất nội bộ", "qty"), col("otherOut", "Xuất khác", "qty"), col("closing", "Tồn cuối kỳ", "qty"),
    col("closingValue", "Giá trị cuối kỳ")],
  damage: [CODE, NAME, col("docs", "Số phiếu", "qty"), col("qty", "SL hủy", "qty"), col("value", "Giá trị hủy")],
  seller: [CODE, NAME, DIM("Nhân viên"), col("qtySold", "SL Bán", "qty"), col("revenue", "Doanh thu"), col("qtyReturned", "SL Trả", "qty"), col("returnValue", "Giá trị trả"), col("net", "Doanh thu thuần")],
  customer: [CODE, NAME, DIM("Khách hàng"), col("qtySold", "SL Mua", "qty"), col("revenue", "Doanh thu"), col("qtyReturned", "SL Trả", "qty"), col("returnValue", "Giá trị trả"), col("net", "Doanh thu thuần")],
  supplier: [CODE, NAME, DIM("Nhà cung cấp"), col("qtySold", "SL Nhập", "qty"), col("revenue", "Giá trị nhập"), col("qtyReturned", "SL Trả", "qty"), col("returnValue", "Giá trị trả"), col("net", "Giá trị nhập thuần")],
};
