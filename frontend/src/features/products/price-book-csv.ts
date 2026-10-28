/** "Xuất file" / "Nhập file" của Thiết lập giá (CSV UTF-8). */
import { downloadCsv } from "@/features/accounting/tax-calc";
import type { PriceBook, PriceRow } from "./price-book-types";

const stamp = () => new Date().toISOString().slice(0, 10);

/** Xuất các dòng đang hiển thị: cột cố định + 1 cột giá cho mỗi bảng giá đang chọn (trống = không có trong bảng). */
export function exportPriceRowsCsv(rows: PriceRow[], books: PriceBook[]) {
  downloadCsv(`thiet-lap-gia-${stamp()}.csv`,
    ["Mã hàng", "Tên hàng", "ĐVT", "Giá vốn", "Giá nhập cuối", "Giá chung", ...books.map((b) => b.name)],
    rows.map((r) => [r.code, r.name, r.unitName, Number(r.cost), r.lastPurchasePrice == null ? "" : Number(r.lastPurchasePrice),
      Number(r.basePrice), ...books.map((b) => (r.prices[b.id] == null ? "" : Number(r.prices[b.id])))]));
}

/** Tách CSV có ngoặc kép; tự nhận dấu phân cách "," hoặc ";" theo dòng đầu. */
function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') quoted = false; else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Đọc file giá: cột "Mã hàng" + cột giá. Cột giá = cột trùng tên bảng giá (file xuất từ màn này) hoặc "Giá"/"Giá bán",
 * không có tiêu đề thì cột 1 = mã, cột 2 = giá. line = số dòng thật trong file để báo lỗi.
 */
export function parsePriceCsv(text: string, bookName: string): { line: number; code: string; price: string }[] {
  const rows = parseCsv(text);
  if (!rows.length) return [];
  const header = rows[0].map(norm);
  const hasHeader = header.includes("mã hàng");
  let codeCol = 0;
  let priceCol = 1;
  if (hasHeader) {
    codeCol = header.indexOf("mã hàng");
    const byName = header.indexOf(norm(bookName));
    const generic = header.findIndex((h) => h === "giá" || h === "giá bán");
    priceCol = byName >= 0 ? byName : generic >= 0 ? generic : codeCol + 1;
  }
  return rows.slice(hasHeader ? 1 : 0)
    .map((r, i) => ({ line: i + (hasHeader ? 2 : 1), code: (r[codeCol] ?? "").trim(), price: (r[priceCol] ?? "").trim() }))
    .filter((r) => r.code || r.price);
}
