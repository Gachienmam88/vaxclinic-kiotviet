/**
 * Thiết lập màn bán hàng, lưu theo từng máy (localStorage KEYS.settings ở sale-storage): Thiết lập in (máy in) + Thiết lập & Hiển thị
 * (Hàng hóa / Giá tiền / Thanh toán). Bản lưu thiếu trường (phiên bản cũ) → lấy mặc định cho trường đó.
 */

export type SaleSortField = "INDEX" | "CODE" | "NAME";
export type SalePaymentMethod = "CASH" | "TRANSFER" | "CARD" | "EWALLET";

export type SaleSettings = {
  // Thiết lập in
  autoPrint: boolean;
  mergePrintLines: boolean; // Gộp hàng cùng loại khi in
  printCopies: number; // Số bản in (Liên)
  printTemplate: "INVOICE";
  // Hàng hóa → Hiển thị
  showCode: boolean;
  showStock: boolean;
  showLineNote: boolean;
  // Hàng hóa → Cài đặt
  mergeSameItems: boolean; // Gộp hàng hóa liên quan: thêm hàng đã có → +1 số lượng (tắt → thêm dòng mới)
  addLine: boolean; // nút (+) trên dòng: thêm 1 dòng mới cùng hàng
  sortField: SaleSortField;
  sortDesc: boolean; // Sắp xếp thứ tự hàng hóa ↑ (tăng) / ↓ (giảm)
  dragDrop: boolean;
  multiSelect: boolean;
  scanQuickAdd: boolean;
  showIndex: boolean;
  showAmount: boolean;
  suggestPaid: boolean;
  qtyInputMode: boolean; // F6: thêm hàng xong → con trỏ vào ô số lượng của dòng đó
  // Giá tiền
  showPrice: boolean;
  showLastPrice: boolean;
  discountType: "VND" | "PERCENT";
  editAmount: boolean; // Chỉnh sửa thành tiền → tính lại đơn giá
  // Thanh toán
  defaultPaymentMethod: SalePaymentMethod;
  paidEqualsDue: boolean;
  autoCompleteQr: boolean;
  speakPaid: boolean;
};

export const DEFAULT_SALE_SETTINGS: SaleSettings = {
  autoPrint: false, mergePrintLines: false, printCopies: 1, printTemplate: "INVOICE",
  showCode: true, showStock: false, showLineNote: false,
  mergeSameItems: true, addLine: true, sortField: "INDEX", sortDesc: true, dragDrop: false, multiSelect: false,
  scanQuickAdd: false, showIndex: true, showAmount: true, suggestPaid: true, qtyInputMode: false,
  showPrice: true, showLastPrice: true, discountType: "VND", editAmount: false,
  defaultPaymentMethod: "CASH", paidEqualsDue: true, autoCompleteQr: false, speakPaid: false,
};

/** Gộp bản lưu với mặc định; bỏ giá trị sai kiểu (bản lưu hỏng / phiên bản cũ). */
export function mergeSettings(saved: unknown): SaleSettings {
  const out = { ...DEFAULT_SALE_SETTINGS };
  if (!saved || typeof saved !== "object") return out;
  for (const k of Object.keys(out) as (keyof SaleSettings)[]) {
    const v = (saved as Record<string, unknown>)[k];
    if (v !== undefined && typeof v === typeof out[k]) (out as Record<string, unknown>)[k] = v;
  }
  out.printCopies = Math.min(Math.max(Math.round(out.printCopies) || 1, 1), 10);
  return out;
}
