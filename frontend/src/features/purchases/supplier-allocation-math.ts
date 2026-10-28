import type { UnpaidReceipt } from "./supplier-types";

export type Allocation = Record<string, number>;

/** Tự phân bổ số tiền vào phiếu nhập còn nợ, phiếu cũ trước; mỗi phiếu tối đa "Còn cần trả" (KiotViet). */
export function distributeOldestFirst(amount: number, receipts: UnpaidReceipt[]): Allocation {
  let left = Math.max(amount, 0);
  return Object.fromEntries(receipts.map((r) => {
    const take = Math.max(0, Math.min(left, r.remaining));
    left -= take;
    return [r.id, take];
  }));
}

export const sumAllocation = (a: Allocation) => Object.values(a).reduce((s, v) => s + v, 0);

/** Sửa 1 dòng "Tiền trả": chặn ở "Còn cần trả" của phiếu đó, không âm. */
export function setRow(a: Allocation, r: UnpaidReceipt, value: number): Allocation {
  return { ...a, [r.id]: Math.max(0, Math.min(value, r.remaining)) };
}

/** Payload allocations gửi API (bỏ dòng 0). */
export const allocationPayload = (a: Allocation) =>
  Object.entries(a).filter(([, v]) => v > 0).map(([receiptId, amount]) => ({ receiptId, amount }));
