import { newKey } from "@/features/products/product-form-state";
import type { ProductDetail } from "@/features/products/product-types";

/** 1 dòng đang soạn trên phiếu nhập / trả hàng nhập. */
export type LineForm = {
  key: string;
  productId: string;
  productName: string;
  lotManaged: boolean;
  units: { id: string; code: string; unitName: string; conversionRate: number }[];
  unitId: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  lotNumber: string;
  expiryDate: string; // yyyy-mm-dd
};

/** Dòng mới từ hàng vừa chọn: đơn vị cơ bản, giá đề xuất = giá vốn hiện tại. */
export function lineFromProduct(p: ProductDetail): LineForm {
  const base = p.units.find((u) => u.base) ?? p.units[0];
  return {
    key: newKey(),
    productId: p.id,
    productName: p.name,
    lotManaged: p.lotManaged,
    units: p.units.map((u) => ({ id: u.id, code: u.code, unitName: u.unitName, conversionRate: Number(u.conversionRate) })),
    unitId: base.id,
    quantity: 1,
    unitPrice: Math.round(Number(p.cost)),
    discount: 0,
    lotNumber: "",
    expiryDate: "",
  };
}

export const unitOf = (l: LineForm) => l.units.find((u) => u.id === l.unitId) ?? l.units[0];

/** Đổi đơn vị: quy đổi lại đơn giá theo tỷ lệ (VD Liều 700,000 → Hộp 10 liều 7,000,000). */
export function changeUnit(l: LineForm, unitId: string): LineForm {
  const from = unitOf(l).conversionRate;
  const to = l.units.find((u) => u.id === unitId)?.conversionRate ?? from;
  return { ...l, unitId, unitPrice: Math.round((l.unitPrice / from) * to), discount: Math.round((l.discount / from) * to) };
}

/** Datetime-local <-> ISO (giờ máy). */
export const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
export const fromLocalInput = (v: string) => new Date(v).toISOString();
