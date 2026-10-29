import type { CartLine } from "./sale-types";

/**
 * Giảm thuế GTGT theo Nghị quyết 204/2025/QH15 (01/07/2025 – 31/12/2026) — giống InvoiceTaxReduction.java:
 * chỉ dòng hàng có cờ "Áp dụng giảm thuế" và thuế suất 10% (VAT10) tính 8%. Giá bán đã gồm thuế → phần giảm =
 * thành tiền sau giảm giá × 2 / 110 (110.000 → 108.000, giảm 2.000). Giảm giá hóa đơn chia theo tỷ lệ thành tiền.
 */
export const TAX_REDUCTION_FROM = "2025-07-01";
export const TAX_REDUCTION_TO = "2026-12-31";

/** Hôm nay (giờ VN) trong thời gian áp dụng → mới hiện nút "Giảm thuế". */
export function taxReductionActive(now = new Date()) {
  const vn = new Date(now.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
  return vn >= TAX_REDUCTION_FROM && vn <= TAX_REDUCTION_TO;
}

export const taxReducible = (l: CartLine) => !!l.taxReduction && l.taxCode === "VAT10";

/** Số tiền giảm thuế của giỏ hàng (subtotal = tổng tiền hàng, afterDiscount = sau giảm giá hóa đơn). */
export function taxReductionAmount(lines: CartLine[], subtotal: number, afterDiscount: number) {
  if (subtotal <= 0) return 0;
  const eligible = lines.filter(taxReducible).reduce((s, l) => s + Math.round(l.quantity * (l.unitPrice - l.discount)), 0);
  return Math.round((eligible * (afterDiscount / subtotal) * 2) / 110);
}
