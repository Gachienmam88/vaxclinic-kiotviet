/**
 * Bản sao phía giao diện của PurchaseMath (backend) để hiển thị tạm tính khi đang nhập phiếu.
 * Backend là nguồn đúng cuối cùng. VAT làm tròn TỪNG DÒNG rồi cộng (khớp hóa đơn thực tế).
 * Chế độ VAT: LINE = VAT% từng dòng (null = KCT); MANUAL = VAT phiếu nhập tay (manualVat).
 */
import type { VatMode } from "./purchase-types";

const roundVnd = (v: number) => Math.round(v);

export type LineAmountInput = { quantity: number; unitPrice: number; discount?: number; vatRate?: number | null };

export const lineAmount = (l: LineAmountInput) => l.quantity * (l.unitPrice - (l.discount ?? 0));

/**
 * vatRate (số) = 1 mức cho mọi dòng (kiểu cũ); undefined = dùng VAT% của từng dòng.
 * manualVat chỉ dùng khi vatMode = MANUAL.
 */
export function purchaseTotals(lines: LineAmountInput[], discount: number, vatRate?: number | null, vatMode: VatMode = "LINE",
  manualVat = 0) {
  const amounts = lines.map(lineAmount);
  const raw = amounts.reduce((s, a) => s + a, 0);
  const subtotal = roundVnd(raw);
  const disc = roundVnd(Math.max(0, Math.min(discount, subtotal)));
  let vat = 0;
  if (vatMode === "MANUAL") vat = roundVnd(Math.max(0, manualVat));
  else if (raw > 0) {
    const keep = 1 - disc / raw;
    vat = lines.reduce((s, l, i) => {
      const rate = vatRate === undefined ? l.vatRate : vatRate;
      return rate == null ? s : s + roundVnd((amounts[i] * keep * rate) / 100);
    }, 0);
  }
  const quantity = lines.reduce((s, l) => s + l.quantity, 0);
  return { subtotal, discount: disc, vat, total: subtotal - disc + vat, quantity };
}

/** Giá nhập có VAT của 1 đơn vị (hiển thị cột "Giá nhập có VAT"). */
export const priceWithVat = (unitPrice: number, discount: number, vatRate: number | null) =>
  (unitPrice - discount) * (1 + (vatRate ?? 0) / 100);

/** Nhãn dòng VAT ở khối tổng: mọi dòng cùng 1 mức → "VAT x%", lẫn mức / nhập tay → "VAT". */
export function commonVatRate(vatMode: VatMode, rates: (number | null)[]): number | null {
  if (vatMode === "MANUAL" || !rates.length) return null;
  const first = rates[0];
  return rates.every((r) => (r == null ? first == null : first != null && Number(r) === Number(first))) ? first : null;
}
