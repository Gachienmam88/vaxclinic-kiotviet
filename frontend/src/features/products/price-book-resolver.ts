/**
 * Chọn giá bán theo bảng giá — chạy hoàn toàn phía máy bán hàng (offline) trên dữ liệu
 * GET /products/pos-catalog?branchId=..&withPriceBooks=true → { products, priceBooks }.
 * File thuần (không import React/alias) để chạy test bằng `node --experimental-strip-types`.
 */

export type CatalogPriceBook = {
  id: string;
  name: string;
  validFrom: string; // ISO
  validTo: string;
  branchIds: string[] | null; // null = tất cả
  customerGroupIds: string[] | null;
  sellerIds: string[] | null;
  missingPolicy: "ALLOW" | "BLOCK" | "WARN";
  prices: Record<string, number>; // productUnitId → giá
};

/** Ngữ cảnh hóa đơn: chi nhánh, nhóm khách (null = khách lẻ / không nhóm), người bán, thời điểm bán. */
export type PriceContext = {
  branchId: string;
  customerGroupId?: string | null;
  sellerId?: string | null;
  date?: Date;
};

/** allowed = false: bảng giá chặn hàng không có trong bảng (không được thêm vào hóa đơn). */
export type PriceResolution = {
  price: number;
  allowed: boolean;
  warning: string | null;
  source: "BOOK" | "BASE";
};

const inScope = (ids: string[] | null, id: string | null | undefined) => ids == null || (!!id && ids.includes(id));

/** Bảng giá dùng được cho hóa đơn này: trong hiệu lực + đúng chi nhánh, nhóm khách, người bán. */
export function isPriceBookApplicable(book: CatalogPriceBook, ctx: PriceContext): boolean {
  const t = (ctx.date ?? new Date()).getTime();
  return t >= Date.parse(book.validFrom) && t <= Date.parse(book.validTo)
    && inScope(book.branchIds, ctx.branchId)
    && inScope(book.customerGroupIds, ctx.customerGroupId)
    && inScope(book.sellerIds, ctx.sellerId);
}

/** Danh sách cho ô chọn "Bảng giá" ở màn bán hàng (ngoài "Bảng giá chung"). */
export function applicablePriceBooks(books: CatalogPriceBook[], ctx: PriceContext): CatalogPriceBook[] {
  return books.filter((b) => isPriceBookApplicable(b, ctx));
}

/**
 * Giá của 1 đơn vị tính theo bảng giá đang chọn (bookId = null → Bảng giá chung).
 * Bảng giá hết hiệu lực / ngoài phạm vi → dùng giá chung kèm cảnh báo.
 * Hàng không có trong bảng: ALLOW → giá chung; WARN → giá chung + cảnh báo; BLOCK → allowed = false.
 */
export function resolvePrice(books: CatalogPriceBook[], ctx: PriceContext & { bookId: string | null },
  productUnitId: string, basePrice: number): PriceResolution {
  const base: PriceResolution = { price: basePrice, allowed: true, warning: null, source: "BASE" };
  if (!ctx.bookId) return base;
  const book = books.find((b) => b.id === ctx.bookId);
  if (!book) return { ...base, warning: "Bảng giá không còn tồn tại — dùng giá chung" };
  if (!isPriceBookApplicable(book, ctx)) {
    return { ...base, warning: `Bảng giá "${book.name}" không áp dụng cho hóa đơn này — dùng giá chung` };
  }
  const price = book.prices[productUnitId];
  if (price != null) return { price: Number(price), allowed: true, warning: null, source: "BOOK" };
  if (book.missingPolicy === "BLOCK") {
    return { ...base, allowed: false, warning: `Hàng không có trong bảng giá "${book.name}"` };
  }
  if (book.missingPolicy === "WARN") {
    return { ...base, warning: `Hàng không có trong bảng giá "${book.name}" — dùng giá chung` };
  }
  return base;
}
