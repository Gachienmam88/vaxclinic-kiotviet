import { formatMoney } from "@/lib/format";
import { code128Svg } from "./barcode-code128";
import { printHtml } from "./print-render";

/** 1 loại tem: mã vạch in theo barcode (nếu có) hoặc mã hàng; copies = số tem cần in. */
export type BarcodeLabel = { code: string; barcode?: string | null; name: string; price: number; copies: number };

/** Giới hạn số tem mỗi lần in để trình duyệt không treo khi phiếu nhập số lượng rất lớn. */
export const MAX_LABELS = 500;

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * "In tem mã": lưới tem 2 cột (≈ 62 × 30 mm) trên khổ in mặc định, mỗi tem gồm tên cửa hàng, tên hàng, mã vạch Code 128,
 * mã và giá bán. Trả về số tem đã in (đã cắt theo MAX_LABELS).
 */
export function printBarcodeLabels(items: BarcodeLabel[], storeName = ""): number {
  const cells: string[] = [];
  for (const it of items) {
    const value = (it.barcode || it.code).trim();
    const cell = `<div style="width:62mm;height:30mm;padding:1.5mm 2mm;border:1px dashed #bbb;overflow:hidden;text-align:center;font-family:Arial,sans-serif">`
      + (storeName ? `<div style="font-size:8px">${escape(storeName)}</div>` : "")
      + `<div style="font-size:10px;font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escape(it.name)}</div>`
      + code128Svg(value, "100%", "11mm")
      + `<div style="font-size:9px">${escape(value)}</div>`
      + `<div style="font-size:11px;font-weight:bold">${formatMoney(it.price)} VND</div></div>`;
    for (let i = 0; i < it.copies && cells.length < MAX_LABELS; i++) cells.push(cell);
  }
  if (cells.length) printHtml(`<div style="display:flex;flex-wrap:wrap;gap:2mm">${cells.join("")}</div>`);
  return cells.length;
}
