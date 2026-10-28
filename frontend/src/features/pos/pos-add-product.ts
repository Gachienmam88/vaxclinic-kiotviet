import { toast } from "sonner";
import type { PriceResolution } from "@/features/products/price-book-resolver";
import { newId } from "./pos-storage";
import type { CatalogProduct, CatalogUnit } from "./pos-types";
import type { PosTabs } from "./use-pos-tabs";

/**
 * Chọn 1 hàng (tìm hàng F3 / lưới hàng / quét mã vạch) vào tab đang mở.
 * - Tab trả hàng: tăng số lượng trả của dòng hóa đơn cùng mã, không thêm vào giỏ bán.
 * - Tab bán / đặt hàng: đã có dòng cùng đơn vị → +1; dòng mới lấy giá theo bảng giá đang chọn
 *   (bảng giá chặn hàng ngoài bảng → không thêm + cảnh báo; có cảnh báo → vẫn thêm + cảnh báo).
 */
export function addProductToTab(tabs: PosTabs, p: CatalogProduct, unitId: string, resolve: (u: CatalogUnit) => PriceResolution) {
  const d = tabs.active;
  if (!d) return;
  const unit = p.units.find((u) => u.id === unitId) ?? p.units[0];
  if (d.returnOf) {
    const r = d.returnOf;
    const line = r.lines.find((l) => l.productCode === unit.code) ?? r.lines.find((l) => p.units.some((u) => u.code === l.productCode));
    if (!line) { toast.error(`${p.name} không có trong hóa đơn ${r.code}`); return; }
    const max = line.sold - line.returned;
    if (line.quantity >= max) { toast.error(`${line.productName}: chỉ còn trả được ${max}`); return; }
    tabs.update({ returnOf: { ...r, lines: r.lines.map((l) => (l === line ? { ...l, quantity: l.quantity + 1 } : l)) } });
    return;
  }
  const isSame = (l: { productId: string; unitId: string }) => l.productId === p.id && l.unitId === unit.id;
  let price = unit.price;
  if (!d.lines.some(isSame)) {
    const r = resolve(unit);
    if (!r.allowed) { toast.warning(r.warning ?? `${p.name} không được bán theo bảng giá này`); return; }
    if (r.warning) toast.warning(`${p.name}: ${r.warning}`);
    price = r.price;
  }
  tabs.setLines((lines) => {
    const same = lines.find(isSame);
    if (same) return lines.map((l) => (l === same ? { ...l, quantity: l.quantity + 1 } : l));
    return [{ key: newId(), productId: p.id, productName: p.name, unitId: unit.id, units: p.units, quantity: 1,
      unitPrice: price, discount: 0, note: "", taxCode: p.taxCode, priceEdited: false }, ...lines];
  });
}
