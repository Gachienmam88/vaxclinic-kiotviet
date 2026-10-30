import { api } from "@/lib/api-client";
import type { ProductDetail } from "@/features/products/product-types";
import { mappingKey, type InputInvoice, type InputInvoiceLine, type ItemMapping } from "./integration-queries";
import { toPicked, type PickedProduct } from "./input-invoice-product-picker";
import { parseInvoiceVatRate } from "./input-invoice-receipt-draft";

/** 1 dòng của popup xác nhận: dòng hóa đơn + hàng / ĐVT đã chọn + SL / đơn giá / giảm giá mỗi đơn vị (sửa được). */
export type ConfirmRow = {
  key: number; line: InputInvoiceLine; product: PickedProduct | null; unitId: string;
  quantity: number; unitPrice: number; discount: number; vatRate: number | null;
};

export const rowAmount = (r: ConfirmRow) => r.quantity * (r.unitPrice - r.discount);

/** Dòng hóa đơn → dòng xác nhận, điền sẵn hàng hóa theo ánh xạ đã nhớ (MST người bán + tên + ĐVT). */
export async function buildConfirmRows(inv: InputInvoice): Promise<ConfirmRow[]> {
  const maps = await api<ItemMapping[]>(`/input-invoices/item-mappings?sellerTaxCode=${encodeURIComponent(inv.sellerTaxCode)}`);
  const byKey = new Map(maps.map((m) => [mappingKey(m.itemName, m.itemUnit), m]));
  const ids = [...new Set(inv.lines.map((l) => byKey.get(mappingKey(l.name, l.unit))?.productId).filter((x): x is string => !!x))];
  // hàng đã xóa / không đọc được → bỏ ánh xạ, người dùng chọn lại
  const products = new Map((await Promise.all(ids.map((id) => api<ProductDetail>(`/products/${id}`).catch(() => null))))
    .filter((p): p is ProductDetail => !!p).map((p) => [p.id, toPicked(p)]));
  return inv.lines.map((l, i) => {
    const m = byKey.get(mappingKey(l.name, l.unit));
    const product = m ? products.get(m.productId) ?? null : null;
    const unitId = product && product.units.some((u) => u.id === m!.unitId) ? m!.unitId : product ? baseUnit(product) : "";
    const qty = Number(l.quantity ?? 1) || 1;
    return { key: i, line: l, product, unitId, quantity: qty, unitPrice: Number(l.unitPrice ?? 0),
      discount: Number(l.discount ?? 0) / qty, vatRate: parseInvoiceVatRate(l.vatRate) };
  });
}

export const baseUnit = (p: PickedProduct) => (p.units.find((u) => u.base) ?? p.units[0])?.id ?? "";
