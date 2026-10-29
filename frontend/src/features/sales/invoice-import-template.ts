/**
 * File mẫu "Import file" danh sách hóa đơn (KiotViet): dòng 1 = nhóm cột, dòng 2 = tên cột, dữ liệu từ dòng 3.
 * Các dòng cùng Mã hóa đơn = 1 hóa đơn; chỉ dòng đầu tiên của mã đó cần thông tin hóa đơn / khách / thanh toán.
 * Tên cột luôn tiếng Việt ở mọi ngôn ngữ (backend InvoiceImportPlanner đọc theo đúng thứ tự cột này).
 */
export const IMPORT_GROUPS = [
  ["Thông tin hóa đơn", ["Mã hóa đơn", "Thời gian", "Người bán", "Kênh bán"]],
  ["Thông tin khách hàng", ["Mã khách hàng", "Tên khách hàng", "Điện thoại", "Email", "Địa chỉ (Khách hàng)", "Khu vực (Khách hàng)",
    "Phường/Xã (Khách hàng)"]],
  ["Thông tin hàng hóa", ["Bảng giá", "Mã hàng", "Số lượng", "Lô", "Hạn sử dụng", "Đơn giá", "Giảm giá %", "Giảm giá"]],
  ["Thông tin thanh toán", ["Giảm giá hóa đơn", "Giảm giá hóa đơn %", "Tiền mặt", "Thẻ", "Chuyển khoản", "Ghi chú"]],
] as const;

export const IMPORT_HEADER: string[] = IMPORT_GROUPS.flatMap(([, cols]) => [...cols]);

/** Khóa JSON gửi backend (ImportRow), cùng thứ tự IMPORT_HEADER. */
const FIELDS = ["code", "time", "seller", "channel", "customerCode", "customerName", "phone", "email", "address", "area", "ward",
  "priceBook", "productCode", "quantity", "lot", "expiry", "price", "discountPercent", "discount", "invoiceDiscount",
  "invoiceDiscountPercent", "cash", "card", "transfer", "note"] as const;
const TIME_COL = 1;
const EXPIRY_COL = 14;

export type ImportRow = { line: number } & Record<(typeof FIELDS)[number], string>;

const SAMPLE: (string | number)[][] = [
  ["HDIP00001", "10/10/2019 09:30", "admin", "Bán trực tiếp", "KH000001", "Nguyễn Văn An", "0901234567", "an.nguyen@gmail.com",
    "12 Lê Lợi", "Hà Nội", "Phường Hoàn Kiếm", "Bảng giá chung", "SP000001", 5, "270620", "13/10/2020", 100000, "", "", 0, "", 500000, "", "", "Hóa đơn mẫu"],
  ["HDIP00001", "", "", "", "", "", "", "", "", "", "", "", "SP000002", 2, "", "", 150000, 10, "", "", "", "", "", "", ""],
  ["HDIP00002", "11/10/2019 14:05", "admin", "Bán trực tiếp", "", "", "", "", "", "", "", "", "SP000003", 1, "", "", 200000, "", 20000, "", "", "", 180000, "", ""],
];

/** Tải "Tải về file mẫu" (.xlsx) — tạo ngay trên trình duyệt. */
export async function downloadInvoiceImportTemplate() {
  const XLSX = await import("xlsx");
  const groupRow: string[] = [];
  const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = [];
  for (const [name, cols] of IMPORT_GROUPS) {
    merges.push({ s: { r: 0, c: groupRow.length }, e: { r: 0, c: groupRow.length + cols.length - 1 } });
    groupRow.push(name, ...Array(cols.length - 1).fill(""));
  }
  const ws = XLSX.utils.aoa_to_sheet([groupRow, IMPORT_HEADER, ...SAMPLE]);
  ws["!merges"] = merges;
  ws["!cols"] = IMPORT_HEADER.map((h) => ({ wch: Math.max(12, h.length + 3) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "DanhSachHoaDon");
  XLSX.writeFile(wb, "MauFileHoaDon.xlsx");
}

const norm = (v: unknown) => String(v ?? "").toLowerCase().replace(/\s+/g, " ").trim();
const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Đọc file .xlsx / .csv thành các dòng chữ + số dòng Excel. Lỗi tiêu đề → throw Error(message tiếng Việt từ `msg`).
 * Ô ngày kiểu Excel (số serial) ở cột Thời gian / Hạn sử dụng → dd/MM/yyyy [HH:mm].
 */
export async function readInvoiceImportFile(file: File, msg: { header: (col: number, name: string) => string; empty: string }): Promise<ImportRow[]> {
  const XLSX = await import("xlsx");
  const csv = file.name.toLowerCase().endsWith(".csv");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array", raw: csv });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: "" });
  const headerAt = rows.findIndex((r) => norm(r[0]) === norm(IMPORT_HEADER[0]));
  const header = headerAt < 0 ? [] : rows[headerAt];
  const bad = IMPORT_HEADER.findIndex((h, i) => norm(header[i]) !== norm(h));
  if (bad >= 0) throw new Error(msg.header(bad + 1, IMPORT_HEADER[bad]));
  const date = (v: unknown, withTime: boolean) => {
    if (typeof v !== "number") return String(v ?? "").trim();
    const d = XLSX.SSF.parse_date_code(v);
    const day = `${pad(d.d)}/${pad(d.m)}/${d.y}`;
    return withTime && (d.H || d.M) ? `${day} ${pad(d.H)}:${pad(d.M)}` : day;
  };
  const out: ImportRow[] = [];
  rows.slice(headerAt + 1).forEach((r, i) => {
    if (!r.some((v) => String(v ?? "").trim())) return;
    const row = { line: headerAt + i + 2 } as ImportRow;
    FIELDS.forEach((f, c) => {
      row[f] = c === TIME_COL ? date(r[c], true) : c === EXPIRY_COL ? date(r[c], false) : String(r[c] ?? "").trim();
    });
    out.push(row);
  });
  if (!out.length) throw new Error(msg.empty);
  return out;
}
