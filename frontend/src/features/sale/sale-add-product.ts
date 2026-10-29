import { toast } from "sonner";
import type { PriceResolution } from "@/features/products/price-book-resolver";
import type { SaleT } from "@/messages/sale";
import { priceWarningText } from "./sale-price-book-pricing";
import { newId } from "./sale-storage";
import type { CatalogProduct, CatalogUnit } from "./sale-types";
import type { SaleTabs } from "./use-sale-tabs";

/**
 * Chọn 1 hàng (tìm hàng F3 / lưới hàng / quét mã vạch) vào tab đang mở.
 * - Tab trả hàng: tăng số lượng trả của dòng hóa đơn cùng mã, không thêm vào giỏ bán.
 * - Tab bán / đặt hàng / trả nhanh: "Gộp hàng hóa liên quan" bật + đã có dòng cùng đơn vị → +1; ngược lại thêm dòng mới
 *   lấy giá theo bảng giá đang chọn (bảng giá chặn hàng ngoài bảng → không thêm + cảnh báo; có cảnh báo → vẫn thêm).
 * Trả về key dòng vừa thêm / tăng (để đưa con trỏ vào ô số lượng khi bật chế độ nhập số lượng).
 */
export function addProductToTab(t: SaleT, tabs: SaleTabs, p: CatalogProduct, unitId: string, resolve: (u: CatalogUnit) => PriceResolution,
                                merge = true): string | null {
  const d = tabs.active;
  if (!d) return null;
  const unit = p.units.find((u) => u.id === unitId) ?? p.units[0];
  if (d.returnOf) {
    const r = d.returnOf;
    const line = r.lines.find((l) => l.productCode === unit.code) ?? r.lines.find((l) => p.units.some((u) => u.code === l.productCode));
    if (!line) { toast.error(t("cart.notInInvoice", { name: p.name, code: r.code })); return null; }
    const max = line.sold - line.returned;
    if (line.quantity >= max) { toast.error(t("cart.returnMax", { name: line.productName, max })); return null; }
    tabs.update({ returnOf: { ...r, lines: r.lines.map((l) => (l === line ? { ...l, quantity: l.quantity + 1 } : l)) } });
    return null;
  }
  const isSame = (l: { productId: string; unitId: string }) => l.productId === p.id && l.unitId === unit.id;
  const existing = merge ? d.lines.find(isSame) : undefined;
  if (existing) {
    tabs.setLines((lines) => lines.map((l) => (l.key === existing.key ? { ...l, quantity: l.quantity + 1 } : l)));
    return existing.key;
  }
  const r = resolve(unit);
  if (!r.allowed) { toast.warning(`${p.name}: ${r.warning ? priceWarningText(t, r.warning) : t("cart.notInPriceBook")}`); return null; }
  if (r.warning) toast.warning(`${p.name}: ${priceWarningText(t, r.warning)}`);
  const key = newId();
  tabs.setLines((lines) => [{ key, productId: p.id, productName: p.name, unitId: unit.id, units: p.units, quantity: 1,
    unitPrice: r.price, discount: 0, note: "", taxCode: p.taxCode, taxReduction: !!p.taxReduction, priceEdited: false }, ...lines]);
  return key;
}
