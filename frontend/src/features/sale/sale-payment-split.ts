import type { DraftInvoice, ExtraPayment } from "./sale-types";

/**
 * Chia tiền khách trả theo phương thức: phương thức chính = paid − Σ phần thêm; tổng vượt số cần trả (tiền thừa)
 * thì bớt ở phần tiền mặt trước, rồi tới phương thức chính → server nhận đúng số đã thu theo từng quỹ.
 */
export function splitPayments(d: Pick<DraftInvoice, "paymentMethod" | "extraPayments">, paid: number, due: number): { primary: number; extras: ExtraPayment[] } {
  const extras = (d.extraPayments ?? []).filter((e) => e.amount > 0).map((e) => ({ ...e }));
  let primary = Math.max(0, paid - extras.reduce((s, e) => s + e.amount, 0));
  let excess = Math.max(0, primary + extras.reduce((s, e) => s + e.amount, 0) - due);
  const cut = (v: number) => { const c = Math.min(v, excess); excess -= c; return v - c; };
  if (d.paymentMethod === "CASH") primary = cut(primary);
  for (const e of extras) if (e.method === "CASH") e.amount = cut(e.amount);
  primary = cut(primary);
  for (const e of extras) e.amount = cut(e.amount);
  return { primary, extras: extras.filter((e) => e.amount > 0) };
}
