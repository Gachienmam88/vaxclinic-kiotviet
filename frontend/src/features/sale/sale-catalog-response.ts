/**
 * Chuẩn hóa dữ liệu danh mục màn bán hàng (pure — chạy test bằng `node --experimental-strip-types`).
 * Server mới: GET /products/sale-catalog?withPriceBooks=true → { products, priceBooks };
 * server cũ / bản lưu cũ trên máy: mảng hàng hóa, không có bảng giá.
 */
import type { CatalogPriceBook } from "../products/price-book-resolver";
import type { CatalogProduct } from "./sale-types";

/** Bản lưu cục bộ (priceBooks không có ở bản lưu trước khi có bảng giá). */
export type CachedCatalog = { at: string; items: CatalogProduct[]; priceBooks?: CatalogPriceBook[] };

type RawCatalog = CatalogProduct[] | { products: CatalogProduct[]; priceBooks?: CatalogPriceBook[] | null };

/** Số từ JSON (BigDecimal có thể về dạng chuỗi) → number. */
export function normalizeCatalog(raw: RawCatalog): { items: CatalogProduct[]; priceBooks: CatalogPriceBook[] } {
  const products = Array.isArray(raw) ? raw : raw.products ?? [];
  const books = Array.isArray(raw) ? [] : raw.priceBooks ?? [];
  return {
    items: products.map((p) => ({ ...p, stock: Number(p.stock),
      units: p.units.map((u) => ({ ...u, price: Number(u.price), conversionRate: Number(u.conversionRate) })) })),
    priceBooks: books.map((b) => ({ ...b,
      prices: Object.fromEntries(Object.entries(b.prices ?? {}).map(([unitId, v]) => [unitId, Number(v)])) })),
  };
}

/** Đọc bản lưu: dạng { at, items, priceBooks? } hoặc mảng hàng hóa (rất cũ) → luôn có priceBooks. */
export function readCachedCatalog(c: CachedCatalog | CatalogProduct[] | null): Required<CachedCatalog> | null {
  if (!c) return null;
  if (Array.isArray(c)) return { at: "", items: c, priceBooks: [] };
  return { at: c.at, items: c.items ?? [], priceBooks: c.priceBooks ?? [] };
}
