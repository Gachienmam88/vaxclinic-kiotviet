/**
 * Đọc file Excel "Nhập danh sách hóa đơn" (hàm thuần, không phụ thuộc thư viện xlsx — nhận mảng dòng của từng trang tính).
 * Mỗi trang tính = 1 giao dịch (1 tab hóa đơn), tối đa 19 trang tính × 250 dòng như KiotViet.
 * Dòng 1 là tiêu đề, đúng thứ tự IMPORT_COLUMNS. Thông tin khách lấy từ dòng đầu tiên có điền thông tin khách.
 */

export const IMPORT_COLUMNS = [
  "Mã hàng", "Tên hàng", "Đơn giá", "Giảm giá", "Giảm giá (%)", "Số lượng", "Lô", "Hạn sử dụng", "Mã khách hàng",
  "Tên khách hàng", "Số điện thoại", "Loại khách", "Địa chỉ", "Khu vực", "Phường xã",
] as const;

export const MAX_SHEETS = 19;
export const MAX_ROWS = 250;

export type ImportRow = {
  row: number; // số dòng trên Excel (tiêu đề = 1)
  code: string; name: string; price: number | null; discount: number | null; discountPercent: number | null;
  quantity: number; lot: string; expiry: string;
};
export type ImportCustomer = {
  code: string; name: string; phone: string; type: "PERSONAL" | "COMPANY"; address: string; area: string; ward: string;
};
export type ImportSheet = { name: string; rows: ImportRow[]; customer: ImportCustomer | null; errors: string[] };
export type RawSheet = { name: string; rows: unknown[][] };

const text = (v: unknown) => (v == null ? "" : String(v).trim());

/** Số trong ô Excel: số thật, hoặc chuỗi "978,000" / "978.000" / "12,5". Rỗng → null; sai → NaN. */
export function parseCellNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
  const s = text(v).replace(/\s/g, "");
  if (!s) return null;
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) return Number(s.replace(/,/g, ""));
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) return Number(s.replace(/\./g, "").replace(",", "."));
  return /^-?\d+([.,]\d+)?$/.test(s) ? Number(s.replace(",", ".")) : NaN;
}

const headerKey = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

function checkHeader(header: unknown[]): string | null {
  const bad = IMPORT_COLUMNS.findIndex((c, i) => headerKey(text(header[i])) !== headerKey(c));
  return bad < 0 ? null : `Sai tiêu đề cột ${bad + 1}: cần "${IMPORT_COLUMNS[bad]}" (dùng file mẫu)`;
}

function parseRow(cells: unknown[], row: number, errors: string[]): ImportRow | null {
  const at = `Dòng ${row}`;
  const code = text(cells[0]);
  if (!code) { errors.push(`${at}: thiếu Mã hàng`); return null; }
  const price = parseCellNumber(cells[2]);
  const discount = parseCellNumber(cells[3]);
  const discountPercent = parseCellNumber(cells[4]);
  const quantity = parseCellNumber(cells[5]);
  if (price != null && (Number.isNaN(price) || price < 0)) { errors.push(`${at}: Đơn giá không hợp lệ`); return null; }
  if (discount != null && (Number.isNaN(discount) || discount < 0)) { errors.push(`${at}: Giảm giá không hợp lệ`); return null; }
  if (discountPercent != null && (Number.isNaN(discountPercent) || discountPercent < 0 || discountPercent > 100)) {
    errors.push(`${at}: Giảm giá (%) phải từ 0 đến 100`); return null;
  }
  if (quantity == null || Number.isNaN(quantity) || quantity <= 0) { errors.push(`${at}: Số lượng phải lớn hơn 0`); return null; }
  return { row, code, name: text(cells[1]), price, discount, discountPercent, quantity, lot: text(cells[6]), expiry: text(cells[7]) };
}

function parseCustomer(cells: unknown[]): ImportCustomer | null {
  const c = cells.slice(8, 15).map(text);
  if (!c.some(Boolean)) return null;
  const type = headerKey(c[3]).startsWith("công ty") || headerKey(c[3]) === "cong ty" ? "COMPANY" : "PERSONAL";
  return { code: c[0], name: c[1], phone: c[2], type, address: c[4], area: c[5], ward: c[6] };
}

/** Đọc các trang tính; lỗi cả file (quá 19 trang tính) → errors chung, không đọc trang nào. */
export function parseImportSheets(sheets: RawSheet[]): { sheets: ImportSheet[]; errors: string[] } {
  if (sheets.length > MAX_SHEETS) return { sheets: [], errors: [`File có ${sheets.length} trang tính, tối đa ${MAX_SHEETS}`] };
  const out: ImportSheet[] = [];
  for (const s of sheets) {
    const data = s.rows.map((r, i) => ({ r: Array.isArray(r) ? r : [], n: i + 1 })).slice(1).filter(({ r }) => r.some((v) => text(v)));
    if (!data.length) continue; // trang tính trống: bỏ qua
    const sheet: ImportSheet = { name: s.name, rows: [], customer: null, errors: [] };
    out.push(sheet);
    const headerError = checkHeader(s.rows[0] ?? []);
    if (headerError) { sheet.errors.push(headerError); continue; }
    if (data.length > MAX_ROWS) { sheet.errors.push(`Có ${data.length} dòng, tối đa ${MAX_ROWS} dòng mỗi trang tính`); continue; }
    for (const { r, n } of data) {
      const row = parseRow(r, n, sheet.errors);
      if (row) sheet.rows.push(row);
      sheet.customer ??= parseCustomer(r);
    }
    if (sheet.customer && !sheet.customer.code && !sheet.customer.phone && !sheet.customer.name) sheet.customer = null;
    if (sheet.customer && !sheet.customer.code && !sheet.customer.phone && sheet.customer.name) {
      sheet.errors.push("Khách hàng mới cần Số điện thoại hoặc Mã khách hàng");
    }
  }
  return { sheets: out, errors: [] };
}
