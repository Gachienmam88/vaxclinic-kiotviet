"use client";

import { api } from "@/lib/api-client";
import { loadVnAdmin } from "@/lib/vn-admin-data";
import { foldVietnamese } from "@/lib/vn-admin-search";
import { toGroupDiscount } from "@/features/sales/customer-group-discount";
import type { Customer, CustomerList, GroupDiscountType } from "@/features/sales/sales-types";
import { IMPORT_COLUMNS, parseImportSheets, type ImportCustomer, type RawSheet } from "./sale-import-parse";
import { mapImportRows, matchAdminUnits, type MappedLine } from "./sale-import-map";
import type { CatalogProduct, SaleCustomer } from "./sale-types";

/** Tải file mẫu "Nhập danh sách hóa đơn" (.xlsx, 1 trang tính, dòng tiêu đề đúng thứ tự cột) — tạo ngay trên trình duyệt. */
export async function downloadImportTemplate() {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.aoa_to_sheet([[...IMPORT_COLUMNS]]);
  ws["!cols"] = IMPORT_COLUMNS.map((c) => ({ wch: Math.max(12, c.length + 4) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "HoaDon1");
  XLSX.writeFile(wb, "MauFileHoaDon.xlsx");
}

/** File Excel → mảng dòng từng trang tính (giữ số / chuỗi như ô). */
async function readSheets(file: File): Promise<RawSheet[]> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
  return wb.SheetNames.map((name) => ({ name, rows: XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, raw: true, defval: "" }) }));
}

const toSale = (c: { id: string; code: string; name: string; phone: string | null; groupId?: string | null; debt?: number;
  groupDiscountType?: string | null; groupDiscountValue?: number | null }): SaleCustomer =>
  ({ id: c.id, code: c.code, name: c.name, phone: c.phone, groupId: c.groupId ?? null, debt: Number(c.debt ?? 0),
    groupDiscount: toGroupDiscount(c.groupDiscountType as GroupDiscountType | null | undefined, c.groupDiscountValue) });

/** Khách theo Mã khách hàng → Số điện thoại → tạo mới (Khu vực / Phường xã theo ĐVHC 2025). Cần mạng. */
async function resolveCustomer(c: ImportCustomer, branchId: string): Promise<SaleCustomer> {
  const find = async (q: string, match: (x: CustomerList["items"][number]) => boolean) =>
    (await api<CustomerList>(`/customers?q=${encodeURIComponent(q)}&size=20`)).items.find(match);
  const byCode = c.code ? await find(c.code, (x) => x.code.toLowerCase() === c.code.toLowerCase()) : undefined;
  if (byCode) return toSale(byCode);
  if (c.code && !c.name) throw new Error(`không tìm thấy khách hàng mã ${c.code}`);
  const digits = c.phone.replace(/\D/g, "");
  const byPhone = digits ? await find(digits, (x) => (x.phone ?? "").replace(/\D/g, "") === digits) : undefined;
  if (byPhone) return toSale(byPhone);
  if (!c.name) throw new Error(`không tìm thấy khách hàng SĐT ${c.phone}, thiếu Tên khách hàng để tạo mới`);
  const admin = matchAdminUnits(await loadVnAdmin(), c.area, c.ward, foldVietnamese);
  if (admin && "error" in admin) throw new Error(admin.error);
  const created = await api<Customer>("/customers", { method: "POST", body: {
    code: c.code || null, name: c.name, phone: c.phone || null, customerType: c.type, address: c.address || null, branchId,
    province: admin?.provinceName || null, ward: admin?.wardName || null, provinceCode: admin?.provinceCode || null, wardCode: admin?.wardCode || null } });
  return toSale(created);
}

export type ImportedSheet = { name: string; lines: MappedLine[]; customer: SaleCustomer | null };
export type ImportResult = { imported: ImportedSheet[]; errors: { sheet: string; messages: string[] }[] };

/**
 * Đọc + kiểm tra file: trang tính có lỗi (tiêu đề, dòng, hàng không có trong danh mục, khách) không được nhập,
 * các trang tính hợp lệ → mỗi trang tính 1 tab hóa đơn. Lô / Hạn sử dụng: hệ thống tự xuất lô theo hạn dùng gần nhất.
 */
export async function importInvoiceWorkbook(file: File, catalog: CatalogProduct[], branchId: string): Promise<ImportResult> {
  const parsed = parseImportSheets(await readSheets(file));
  if (parsed.errors.length) return { imported: [], errors: [{ sheet: file.name, messages: parsed.errors }] };
  const out: ImportResult = { imported: [], errors: [] };
  for (const s of parsed.sheets) {
    const mapped = mapImportRows(s.rows, catalog, foldVietnamese);
    const messages = [...s.errors, ...mapped.errors];
    if (!messages.length && !mapped.lines.length) messages.push("Không có dòng hàng nào");
    let customer: SaleCustomer | null = null;
    if (!messages.length && s.customer) {
      try { customer = await resolveCustomer(s.customer, branchId); } catch (e) { messages.push(`Khách hàng: ${(e as Error).message}`); }
    }
    if (messages.length) out.errors.push({ sheet: s.name, messages });
    else out.imported.push({ name: s.name, lines: mapped.lines, customer });
  }
  if (!parsed.sheets.length) out.errors.push({ sheet: file.name, messages: ["File không có dữ liệu"] });
  return out;
}
