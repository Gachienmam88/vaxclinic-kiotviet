import { formatMoney, formatNumber } from "@/lib/format";
import type { CustomerGroup, GroupDiscountType } from "./sales-types";

export type GroupDiscount = { type: GroupDiscountType; value: number };

/** "10%" / "20,000" — trống nếu nhóm không giảm giá. */
export const groupDiscountLabel = (g: Pick<CustomerGroup, "discountType" | "discountValue">) =>
  !Number(g.discountValue) ? "" : g.discountType === "PERCENT" ? `${formatNumber(g.discountValue)}%` : formatMoney(g.discountValue);

/** Giảm giá nhóm của khách (null = không có nhóm / nhóm không giảm). */
export function toGroupDiscount(type: GroupDiscountType | null | undefined, value: number | null | undefined): GroupDiscount | null {
  const v = Number(value ?? 0);
  return type && v > 0 ? { type, value: v } : null;
}
