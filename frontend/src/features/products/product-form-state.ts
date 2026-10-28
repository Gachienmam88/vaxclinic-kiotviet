import type { ProductDetail } from "./product-types";

/** Trạng thái form hàng hóa + chuyển đổi sang body API. Đơn vị đầu tiên luôn là đơn vị cơ bản. */

export type UnitForm = {
  key: string; // khóa React
  id: string | null;
  code: string;
  barcode: string;
  unitName: string;
  conversionRate: number;
  price: number;
  directSale: boolean;
};

export type LotForm = { key: string; lotNumber: string; expiryDate: string; quantity: number };

export type ProductForm = {
  name: string;
  shortName: string;
  einvoiceName: string;
  categoryId: string;
  taxRateId: string;
  taxReduction: boolean;
  lotManaged: boolean;
  cost: number;
  minStock: number;
  maxStock: number;
  positionId: string;
  weight: number;
  weightUnit: "g" | "kg";
  description: string;
  note: string;
  loyaltyPoints: boolean;
  units: UnitForm[];
  // Tồn đầu kỳ (chỉ khi tạo mới)
  openingBranchId: string;
  openingQty: number;
  openingLots: LotForm[];
};

export const newKey = () => Math.random().toString(36).slice(2);

export const emptyUnit = (base = false): UnitForm => ({
  key: newKey(), id: null, code: "", barcode: "", unitName: "", conversionRate: base ? 1 : 0, price: 0, directSale: true,
});

export function emptyProductForm(defaults: { categoryId?: string; taxRateId?: string; branchId?: string }): ProductForm {
  return {
    name: "", shortName: "", einvoiceName: "", categoryId: defaults.categoryId ?? "", taxRateId: defaults.taxRateId ?? "",
    taxReduction: false, lotManaged: false, cost: 0, minStock: 0, maxStock: 999_999_999, positionId: "",
    weight: 0, weightUnit: "g", description: "", note: "", loyaltyPoints: true, units: [emptyUnit(true)],
    openingBranchId: defaults.branchId ?? "", openingQty: 0, openingLots: [],
  };
}

export function formFromDetail(p: ProductDetail): ProductForm {
  return {
    name: p.name, shortName: p.shortName ?? "", einvoiceName: p.einvoiceName ?? "", categoryId: p.categoryId,
    taxRateId: p.taxRateId ?? "", taxReduction: p.taxReduction, lotManaged: p.lotManaged, cost: Number(p.cost),
    minStock: Number(p.minStock), maxStock: Number(p.maxStock), positionId: p.positionId ?? "",
    weight: Number(p.weight ?? 0), weightUnit: p.weightUnit === "kg" ? "kg" : "g", description: p.description ?? "",
    note: p.note ?? "", loyaltyPoints: p.loyaltyPoints,
    units: p.units.map((u) => ({
      key: u.id, id: u.id, code: u.code, barcode: u.barcode ?? "", unitName: u.unitName,
      conversionRate: Number(u.conversionRate), price: Number(u.price), directSale: u.directSale,
    })),
    openingBranchId: "", openingQty: 0, openingLots: [],
  };
}

export function toRequest(f: ProductForm, isCreate: boolean) {
  const opening = !isCreate || !f.openingBranchId ? null : {
    branchId: f.openingBranchId,
    quantity: f.lotManaged ? null : f.openingQty,
    lots: f.lotManaged
      ? f.openingLots.map((l) => ({ lotNumber: l.lotNumber, expiryDate: l.expiryDate, quantity: l.quantity }))
      : null,
  };
  return {
    name: f.name, shortName: f.shortName, einvoiceName: f.einvoiceName, categoryId: f.categoryId || null,
    taxRateId: f.taxRateId || null, taxReduction: f.taxReduction, lotManaged: f.lotManaged, cost: f.cost,
    minStock: f.minStock, maxStock: f.maxStock, positionId: f.positionId || null, weight: f.weight || null,
    weightUnit: f.weightUnit, description: f.description, note: f.note, loyaltyPoints: f.loyaltyPoints,
    units: f.units.map((u) => ({
      id: u.id, code: u.code, barcode: u.barcode, unitName: u.unitName,
      conversionRate: u.conversionRate, price: u.price, directSale: u.directSale,
    })),
    openingStock: opening,
  };
}
