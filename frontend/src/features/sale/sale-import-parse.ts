/**
 * Đọc file Excel "Nhập danh sách hóa đơn" (hàm thuần, không phụ thuộc thư viện xlsx — nhận mảng dòng của từng trang tính).
 * Mỗi trang tính = 1 giao dịch (1 tab hóa đơn), tối đa 19 trang tính × 250 dòng như KiotViet.
 * Dòng 1 là tiêu đề, đúng thứ tự IMPORT_COLUMNS. Thông tin khách lấy từ dòng đầu tiên có điền thông tin khách.
 * Tiêu đề cột luôn là tiếng Việt ở mọi ngôn ngữ giao diện (file mẫu + file khách nhập được đọc theo đúng các tên này).
 * Câu báo lỗi: truyền `msg` (hàm dịch namespace sale, khóa import.errors.*); không truyền → tiếng Việt (test node).
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

type Vars = Record<string, string | number>;
/** Khóa lỗi đọc file — trùng khóa trong messages/<locale>/sale.json. */
export type ImportParseKey = "import.errors.header" | "import.errors.missingCode" | "import.errors.badPrice" | "import.errors.badDiscount"
  | "import.errors.badDiscountPercent" | "import.errors.badQty" | "import.errors.tooManySheets" | "import.errors.tooManyRows";
export type ImportParseMsg = (key: ImportParseKey, vars?: Vars) => string;

/** Bản tiếng Việt mặc định (giống messages/vi/sale.json → import.errors) để hàm thuần chạy được không cần i18n. */
const VI: Record<ImportParseKey, string> = {
  "import.errors.header": 'Sai tiêu đề cột {col}: cần "{name}" (dùng file mẫu)',
  "import.errors.missingCode": "Dòng {row}: thiếu Mã hàng",
  "import.errors.badPrice": "Dòng {row}: Đơn giá không hợp lệ",
  "import.errors.badDiscount": "Dòng {row}: Giảm giá không hợp lệ",
  "import.errors.badDiscountPercent": "Dòng {row}: Giảm giá (%) phải từ 0 đến 100",
  "import.errors.badQty": "Dòng {row}: Số lượng phải lớn hơn 0",
  "import.errors.tooManySheets": "File có {sheets} trang tính, tối đa {max}",
  "import.errors.tooManyRows": "Có {rows} dòng, tối đa {max} dòng mỗi trang tính",
};
const viMsg: ImportParseMsg = (key, vars = {}) => VI[key].replace(/\{(\w+)\}/g, (w, n: string) => (n in vars ? String(vars[n]) : w));

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

function checkHeader(header: unknown[], msg: ImportParseMsg): string | null {
  const bad = IMPORT_COLUMNS.findIndex((c, i) => headerKey(text(header[i])) !== headerKey(c));
  return bad < 0 ? null : msg("import.errors.header", { col: bad + 1, name: IMPORT_COLUMNS[bad] });
}

function parseRow(cells: unknown[], row: number, errors: string[], msg: ImportParseMsg): ImportRow | null {
  const fail = (key: ImportParseKey) => { errors.push(msg(key, { row })); return null; };
  const code = text(cells[0]);
  if (!code) return fail("import.errors.missingCode");
  const price = parseCellNumber(cells[2]);
  const discount = parseCellNumber(cells[3]);
  const discountPercent = parseCellNumber(cells[4]);
  const quantity = parseCellNumber(cells[5]);
  if (price != null && (Number.isNaN(price) || price < 0)) return fail("import.errors.badPrice");
  if (discount != null && (Number.isNaN(discount) || discount < 0)) return fail("import.errors.badDiscount");
  if (discountPercent != null && (Number.isNaN(discountPercent) || discountPercent < 0 || discountPercent > 100)) {
    return fail("import.errors.badDiscountPercent");
  }
  if (quantity == null || Number.isNaN(quantity) || quantity <= 0) return fail("import.errors.badQty");
  return { row, code, name: text(cells[1]), price, discount, discountPercent, quantity, lot: text(cells[6]), expiry: text(cells[7]) };
}

function parseCustomer(cells: unknown[]): ImportCustomer | null {
  const c = cells.slice(8, 15).map(text);
  if (!c.some(Boolean)) return null;
  const type = headerKey(c[3]).startsWith("công ty") || headerKey(c[3]) === "cong ty" ? "COMPANY" : "PERSONAL";
  return { code: c[0], name: c[1], phone: c[2], type, address: c[4], area: c[5], ward: c[6] };
}

/** Đọc các trang tính; lỗi cả file (quá 19 trang tính) → errors chung, không đọc trang nào. */
export function parseImportSheets(sheets: RawSheet[], msg: ImportParseMsg = viMsg): { sheets: ImportSheet[]; errors: string[] } {
  if (sheets.length > MAX_SHEETS) return { sheets: [], errors: [msg("import.errors.tooManySheets", { sheets: sheets.length, max: MAX_SHEETS })] };
  const out: ImportSheet[] = [];
  for (const s of sheets) {
    const data = s.rows.map((r, i) => ({ r: Array.isArray(r) ? r : [], n: i + 1 })).slice(1).filter(({ r }) => r.some((v) => text(v)));
    if (!data.length) continue; // trang tính trống: bỏ qua
    const sheet: ImportSheet = { name: s.name, rows: [], customer: null, errors: [] };
    out.push(sheet);
    const headerError = checkHeader(s.rows[0] ?? [], msg);
    if (headerError) { sheet.errors.push(headerError); continue; }
    if (data.length > MAX_ROWS) { sheet.errors.push(msg("import.errors.tooManyRows", { rows: data.length, max: MAX_ROWS })); continue; }
    for (const { r, n } of data) {
      const row = parseRow(r, n, sheet.errors, msg);
      if (row) sheet.rows.push(row);
      sheet.customer ??= parseCustomer(r);
    }
    if (sheet.customer && !sheet.customer.code && !sheet.customer.phone && !sheet.customer.name) sheet.customer = null;
  }
  return { sheets: out, errors: [] };
}
