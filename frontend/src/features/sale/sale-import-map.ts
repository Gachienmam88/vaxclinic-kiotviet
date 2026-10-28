/**
 * Ghép dữ liệu file import với danh mục trên máy (hàm thuần): Mã hàng → hàng + đơn vị (mã đơn vị hoặc mã vạch),
 * Khu vực / Phường xã → mã ĐVHC 2025. `fold` = bỏ dấu tiếng Việt (truyền vào để kiểm thử độc lập).
 */
import type { CatalogProduct, CatalogUnit } from "./sale-types";
import type { ImportRow } from "./sale-import-parse";

export type MappedLine = {
  product: CatalogProduct; unit: CatalogUnit; quantity: number; unitPrice: number; discount: number; row: number;
};

type Fold = (s: string) => string;
type Vars = Record<string, string | number>;
/** Khóa lỗi ghép dữ liệu — trùng khóa trong messages/<locale>/sale.json; không truyền hàm dịch → tiếng Việt (test node). */
export type ImportMapKey = "import.errors.productNotFound" | "import.errors.areaNotFound" | "import.errors.wardNotFound";
export type ImportMapMsg = (key: ImportMapKey, vars?: Vars) => string;
const VI: Record<ImportMapKey, string> = {
  "import.errors.productNotFound": "Dòng {row}: không tìm thấy hàng hóa mã {code}",
  "import.errors.areaNotFound": 'không tìm thấy Khu vực "{area}" (danh mục 34 tỉnh/thành 2025)',
  "import.errors.wardNotFound": 'không tìm thấy Phường xã "{ward}" thuộc {province}',
};
const viMsg: ImportMapMsg = (key, vars = {}) => VI[key].replace(/\{(\w+)\}/g, (w, n: string) => (n in vars ? String(vars[n]) : w));
type Unit = { code: string; name: string; provinceCode?: string };
export type AdminUnits = { provinces: Unit[]; wardsOf: (provinceCode: string) => Unit[] };

/** Dòng import → dòng giỏ hàng. Giá trống = giá bán của đơn vị; Giảm giá (%) ưu tiên hơn Giảm giá (VND / 1 đơn vị). */
export function mapImportRows(rows: ImportRow[], catalog: CatalogProduct[], fold: Fold, msg: ImportMapMsg = viMsg) {
  const byCode = new Map<string, { product: CatalogProduct; unit: CatalogUnit }>();
  for (const p of catalog) {
    for (const u of p.units) {
      byCode.set(fold(u.code), { product: p, unit: u });
      if (u.barcode) byCode.set(fold(u.barcode), { product: p, unit: u });
    }
  }
  const lines: MappedLine[] = [];
  const errors: string[] = [];
  for (const r of rows) {
    const hit = byCode.get(fold(r.code));
    if (!hit) { errors.push(msg("import.errors.productNotFound", { row: r.row, code: r.code })); continue; }
    const unitPrice = r.price ?? hit.unit.price;
    const raw = r.discountPercent != null ? (unitPrice * r.discountPercent) / 100 : r.discount ?? 0;
    const discount = Math.min(Math.round(raw), unitPrice);
    lines.push({ product: hit.product, unit: hit.unit, quantity: r.quantity, unitPrice, discount, row: r.row });
  }
  return { lines, errors };
}

/** Bỏ tiền tố loại ĐVHC để "Hà Nội" khớp "Thành phố Hà Nội", "Ba Đình" khớp "Phường Ba Đình". */
const bare = (fold: Fold, s: string) => fold(s).replace(/^(thanh pho|tinh|phuong|xa|dac khu|tp\.?)\s+/, "");

/** Khu vực (tỉnh/thành) + Phường xã theo tên → mã. Không khớp → lỗi (không đoán). */
export function matchAdminUnits(data: AdminUnits, area: string, ward: string, fold: Fold, msg: ImportMapMsg = viMsg):
  { provinceCode: string; provinceName: string; wardCode: string; wardName: string } | { error: string } | null {
  if (!area.trim() && !ward.trim()) return null;
  const province = data.provinces.find((p) => fold(p.name) === fold(area) || bare(fold, p.name) === bare(fold, area));
  if (!province) return { error: msg("import.errors.areaNotFound", { area }) };
  if (!ward.trim()) return { provinceCode: province.code, provinceName: province.name, wardCode: "", wardName: "" };
  const w = data.wardsOf(province.code).find((x) => fold(x.name) === fold(ward) || bare(fold, x.name) === bare(fold, ward));
  if (!w) return { error: msg("import.errors.wardNotFound", { ward, province: province.name }) };
  return { provinceCode: province.code, provinceName: province.name, wardCode: w.code, wardName: w.name };
}
