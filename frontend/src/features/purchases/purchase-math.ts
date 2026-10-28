/**
 * Bản sao phía giao diện của PurchaseMath (backend) để hiển thị tạm tính khi đang nhập phiếu.
 * Backend là nguồn đúng cuối cùng. VAT làm tròn TỪNG DÒNG rồi cộng (khớp hóa đơn thực tế).
 */

const roundVnd = (v: number) => Math.round(v);

export type LineAmountInput = { quantity: number; unitPrice: number; discount?: number };

export const lineAmount = (l: LineAmountInput) => l.quantity * (l.unitPrice - (l.discount ?? 0));

export function purchaseTotals(lines: LineAmountInput[], discount: number, vatRate: number | null) {
  const amounts = lines.map(lineAmount);
  const raw = amounts.reduce((s, a) => s + a, 0);
  const subtotal = roundVnd(raw);
  const disc = roundVnd(Math.min(discount, subtotal));
  let vat = 0;
  if (vatRate != null && raw > 0) {
    const keep = 1 - disc / raw;
    vat = amounts.reduce((s, a) => s + roundVnd((a * keep * vatRate) / 100), 0);
  }
  const quantity = lines.reduce((s, l) => s + l.quantity, 0);
  return { subtotal, discount: disc, vat, total: subtotal - disc + vat, quantity };
}

/** Giá nhập có VAT của 1 đơn vị (hiển thị cột "Giá nhập có VAT"). */
export const priceWithVat = (unitPrice: number, discount: number, vatRate: number | null) =>
  (unitPrice - discount) * (1 + (vatRate ?? 0) / 100);
