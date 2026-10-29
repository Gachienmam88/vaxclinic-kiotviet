import { api } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { loadVnAdmin } from "@/lib/vn-admin-data";
import type { EInvoiceRecord } from "@/features/integrations/integration-queries";
import type { Branch } from "@/features/settings/settings-queries";
import { DETAIL_GROUPS, invoiceValue, type Cell, type DetailRow, type ExportLookups, type ExportResponse } from "./invoice-export-fields";
import { INVOICE_COLUMNS, type InvoiceColumn } from "./invoice-list-prefs";

/**
 * Dựng file Excel "Xuất file" danh sách hóa đơn như KiotViet (dòng tiêu đề có lọc, cột tiền định dạng 1,000):
 * dữ liệu = MỌI hóa đơn khớp bộ lọc hiện tại (GET /invoices/export), không chỉ trang đang xem.
 * Ô chữ bắt đầu bằng = + - @ được thêm dấu ' (chặn công thức khi mở bằng Excel / Sheets).
 */
const MONEY = new Set(["subtotal", "discount", "total", "paid", "cod", "partnerFee", "cash", "card", "ewallet", "transfer",
  "unitPrice", "lineDiscount", "price", "amount"]);
const EINV = ["einvoice", "einvoiceNature", "einvoiceNo", "einvoiceSeries"];

const safe = (v: Cell): Cell => (typeof v === "string" && /^[=+\-@]/.test(v) ? `'${v}` : v ?? null);
const pad = (n: number, w = 2) => String(n).padStart(w, "0");

/** DanhSachHoaDon_KV29102026-174848-092.xlsx */
export function exportFileName(base: string, d = new Date()) {
  return `${base}_KV${pad(d.getDate())}${pad(d.getMonth() + 1)}${d.getFullYear()}-${pad(d.getHours())}${pad(d.getMinutes())}`
    + `${pad(d.getSeconds())}-${pad(d.getMilliseconds(), 3)}.xlsx`;
}

async function chunked<T, R>(items: T[], size: number, run: (part: T[]) => Promise<R[]>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await run(items.slice(i, i + size))));
  return out;
}

async function lookups(data: ExportResponse, keys: string[]): Promise<ExportLookups> {
  const need = (...k: string[]) => k.some((x) => keys.includes(x));
  const lk: ExportLookups = { einv: new Map(), branches: new Map(), sellerTaxCode: null, category: new Map(), barcode: new Map(),
    expiry: new Map(), wardName: new Map() };
  if (need(...EINV)) {
    const recs = await chunked(data.items.map((i) => i.id), 80,
      (ids) => api<EInvoiceRecord[]>(`/einvoices?${ids.map((id) => `invoiceIds=${id}`).join("&")}`));
    recs.forEach((r) => lk.einv.set(r.invoice_id, r));
  }
  if (need("branch")) (await api<Branch[]>("/branches")).forEach((b) => lk.branches.set(b.id, b.name));
  if (need("sellerTaxCode")) lk.sellerTaxCode = (await api<{ store: { taxCode: string | null } | null }>("/settings"))?.store?.taxCode ?? null;
  const productIds = [...new Set(data.lines.map((l) => l.productId))];
  if (need("category", "barcode")) {
    type P = { categoryName: string | null; units: { code: string; barcode: string | null }[] };
    const products = await chunked(productIds, 6, (ids) => Promise.all(ids.map((id) => api<P>(`/products/${id}`).then((p) => [id, p] as const))));
    for (const [id, p] of products) {
      if (p.categoryName) lk.category.set(id, p.categoryName);
      p.units.forEach((u) => u.barcode && lk.barcode.set(u.code.toUpperCase(), u.barcode));
    }
  }
  if (need("expiry")) {
    const lotted = [...new Set(data.lines.filter((l) => l.lots).map((l) => l.productId))];
    type L = { lotNumber: string; expiryDate: string };
    const all = await chunked(lotted, 6, (ids) => Promise.all(ids.map((id) => api<L[]>(`/products/${id}/lots`).then((ls) => [id, ls] as const))));
    for (const [id, ls] of all) ls.forEach((l) => lk.expiry.set(`${id}|${l.lotNumber}`, formatDate(l.expiryDate)));
  }
  if (need("receiverWard") && data.extras.some((e) => e.receiverWardCode)) {
    (await loadVnAdmin()).wards.forEach((w) => lk.wardName.set(w.code, w.name));
  }
  return lk;
}

async function writeXlsx(header: string[], rows: Cell[][], keys: string[], sheetName: string): Promise<Blob> {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows.map((r) => r.map(safe))]);
  const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
  ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 0, c: range.e.c } }) };
  ws["!cols"] = header.map((h) => ({ wch: Math.max(12, h.length + 4) }));
  keys.forEach((k, c) => {
    if (!MONEY.has(k)) return;
    for (let r = 1; r <= range.e.r; r++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (cell?.t === "n") cell.z = "#,##0";
    }
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  return new Blob([XLSX.write(wb, { type: "array", bookType: "xlsx" })], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

function exportQuery(params: URLSearchParams, detail: boolean) {
  const p = new URLSearchParams(params);
  p.delete("page");
  p.delete("size");
  p.set("detail", String(detail));
  return `/invoices/export?${p}`;
}

/** "Xuất file tổng quan": mỗi hóa đơn 1 dòng, đúng các cột đang hiển thị trên danh sách. */
export async function exportInvoiceOverview(params: URLSearchParams, cols: InvoiceColumn[]) {
  const data = await api<ExportResponse>(exportQuery(params, false));
  const visible = INVOICE_COLUMNS.filter(([k]) => cols.includes(k));
  const keys = ["code", ...visible.map(([k]) => k as string)];
  const lk = await lookups(data, keys);
  const rows = data.items.map((i) => keys.map((k) => invoiceValue(i, k, lk)));
  const name = exportFileName("DanhSachHoaDon");
  return { name, blob: await writeXlsx(["Mã hóa đơn", ...visible.map(([, l]) => l)], rows, keys, name.replace(".xlsx", "")) };
}

/** "Xuất file chi tiết": mỗi dòng hàng 1 dòng, các cột chọn trong "Tùy chọn cột hiển thị" (thứ tự theo nhóm). */
export async function exportInvoiceDetail(params: URLSearchParams, selected: string[]) {
  const data = await api<ExportResponse>(exportQuery(params, true));
  const fields = DETAIL_GROUPS.flatMap((g) => g.fields).filter((f) => selected.includes(f.key));
  const keys = fields.map((f) => f.key);
  const lk = await lookups(data, keys);
  const byId = new Map(data.items.map((i) => [i.id, i]));
  const extras = new Map(data.extras.map((e) => [e.invoiceId, e]));
  const order = new Map(data.items.map((i, n) => [i.id, n]));
  const lines = [...data.lines].sort((a, b) => (order.get(a.invoiceId) ?? 0) - (order.get(b.invoiceId) ?? 0) || a.lineNo - b.lineNo);
  const rows = lines.map((line) => {
    const r: DetailRow = { inv: byId.get(line.invoiceId)!, line, extra: extras.get(line.invoiceId), lk };
    return fields.map((f) => f.value(r));
  });
  const name = exportFileName("DanhSachChiTietHoaDon");
  return { name, blob: await writeXlsx(fields.map((f) => f.label), rows, keys, name.replace(".xlsx", "")) };
}
