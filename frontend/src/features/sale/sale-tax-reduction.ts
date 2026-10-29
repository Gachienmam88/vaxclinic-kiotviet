import type { CartLine, DraftInvoice } from "./sale-types";

/**
 * Giảm thuế GTGT theo Nghị quyết 204/2025/QH15 (01/07/2025 – 31/12/2026). Số chính thức do server tính (tra hàng +
 * phương pháp tính thuế: khấu trừ 10% → 8% / trực tiếp 20% tỷ lệ % ngành) qua POST /invoices/tax-reduction-preview;
 * taxReductionAmount chỉ là ước tính khấu trừ khi chưa có kết quả server (mất mạng / đang tải).
 */
export const TAX_REDUCTION_FROM = "2025-07-01";
export const TAX_REDUCTION_TO = "2026-12-31";

/** Hôm nay (giờ VN) trong thời gian áp dụng → mới hiện nút "Giảm thuế". */
export function taxReductionActive(now = new Date()) {
  const vn = new Date(now.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
  return vn >= TAX_REDUCTION_FROM && vn <= TAX_REDUCTION_TO;
}

/** Khóa giỏ hàng cho kết quả xem trước: đổi hàng / SL / giá / giảm giá → tính lại. */
export const taxPreviewKey = (d: DraftInvoice, discount: number) =>
  JSON.stringify([discount, d.lines.map((l) => [l.productId, l.unitId, l.quantity, l.unitPrice, l.discount])]);

export const taxReducible = (l: CartLine) => !!l.taxReduction && l.taxCode === "VAT10";

/** Số tiền giảm thuế của giỏ hàng (subtotal = tổng tiền hàng, afterDiscount = sau giảm giá hóa đơn). */
export function taxReductionAmount(lines: CartLine[], subtotal: number, afterDiscount: number) {
  if (subtotal <= 0) return 0;
  const eligible = lines.filter(taxReducible).reduce((s, l) => s + Math.round(l.quantity * (l.unitPrice - l.discount)), 0);
  return Math.round((eligible * (afterDiscount / subtotal) * 2) / 110);
}
