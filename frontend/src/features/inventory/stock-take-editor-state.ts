import { api } from "@/lib/api-client";
import { newKey } from "@/features/products/product-form-state";
import type { ProductDetail, ProductLot } from "@/features/products/product-types";
import type { StockTake } from "./inventory-types";

/** 1 dòng kiểm (đơn vị cơ bản): 1 hàng, hoặc 1 lô của hàng theo lô. actual null = chưa kiểm. */
export type TakeRow = {
  key: string;
  productId: string;
  productCode: string;
  productName: string;
  unitName: string;
  lotManaged: boolean;
  lotNumber: string;
  expiryDate: string; // yyyy-mm-dd
  newLot: boolean; // lô người dùng tự thêm (chưa có trong kho) → nhập số lô + HSD
  systemQty: number;
  actual: number | null;
  cost: number;
};

export type TakeEditorState = { id: string | null; code: string | null; branchId: string; note: string; rows: TakeRow[] };

export type TakeTab = "all" | "match" | "diff" | "unchecked";

export const diffOf = (r: TakeRow) => (r.actual == null ? 0 : r.actual - r.systemQty);

export function tabOf(r: TakeRow): Exclude<TakeTab, "all"> {
  if (r.actual == null) return "unchecked";
  return diffOf(r) === 0 ? "match" : "diff";
}

export const emptyTake = (branchId: string): TakeEditorState => ({ id: null, code: null, branchId, note: "", rows: [] });

function baseRow(p: ProductDetail): Omit<TakeRow, "lotNumber" | "expiryDate" | "newLot" | "systemQty"> {
  const base = p.units.find((u) => u.base) ?? p.units[0];
  return { key: newKey(), productId: p.id, productCode: base.code, productName: p.name, unitName: base.unitName,
    lotManaged: p.lotManaged, actual: null, cost: Number(p.cost) };
}

/** Dòng lô mới (chưa có trong kho) để nhập số lô + hạn sử dụng. */
export const newLotRow = (p: ProductDetail): TakeRow => ({ ...baseRow(p), lotNumber: "", expiryDate: "", newLot: true, systemQty: 0 });

/** Hàng vừa chọn → các dòng kiểm: hàng theo lô = mỗi lô đang tồn tại chi nhánh 1 dòng; hàng thường = 1 dòng. */
export async function rowsForProduct(p: ProductDetail, branchId: string, existing: TakeRow[]): Promise<TakeRow[]> {
  const has = (lot: string) => existing.some((r) => r.productId === p.id && r.lotNumber === lot);
  if (!p.lotManaged) {
    if (has("")) return [];
    const qty = p.stocks.filter((s) => s.branchId === branchId).reduce((n, s) => n + Number(s.quantity), 0);
    return [{ ...baseRow(p), lotNumber: "", expiryDate: "", newLot: false, systemQty: qty }];
  }
  const lots = (await api<ProductLot[]>(`/products/${p.id}/lots`)).filter((l) => l.branchId === branchId && !has(l.lotNumber));
  if (!lots.length) return existing.some((r) => r.productId === p.id) ? [] : [newLotRow(p)];
  return lots.map((l) => ({ ...baseRow(p), key: newKey(), lotNumber: l.lotNumber, expiryDate: l.expiryDate, newLot: false,
    systemQty: Number(l.quantity) }));
}

export const takeEditorFromDoc = (t: StockTake): TakeEditorState => ({
  id: t.id, code: t.code, branchId: t.branchId, note: t.note ?? "",
  rows: t.lines.map((l) => ({
    key: newKey(), productId: l.productId, productCode: l.productCode, productName: l.productName, unitName: l.unitName,
    lotManaged: l.lotManaged, lotNumber: l.lotNumber ?? "", expiryDate: l.expiryDate ?? "", newLot: false,
    systemQty: Number(l.systemQuantity), actual: l.actualQuantity == null ? null : Number(l.actualQuantity), cost: Number(l.cost),
  })),
});

export const takeRequest = (s: TakeEditorState) => ({
  branchId: s.branchId, note: s.note,
  lines: s.rows.map((r) => ({ productId: r.productId, lotNumber: r.lotNumber || null, expiryDate: r.expiryDate || null,
    actualQuantity: r.actual })),
});

export function takeTotals(rows: TakeRow[]) {
  const counted = rows.filter((r) => r.actual != null);
  return {
    actualQty: counted.reduce((n, r) => n + (r.actual ?? 0), 0),
    diffValue: Math.round(counted.reduce((n, r) => n + diffOf(r) * r.cost, 0)),
    increase: counted.reduce((n, r) => n + Math.max(diffOf(r), 0), 0),
    decrease: counted.reduce((n, r) => n + Math.max(-diffOf(r), 0), 0),
  };
}
