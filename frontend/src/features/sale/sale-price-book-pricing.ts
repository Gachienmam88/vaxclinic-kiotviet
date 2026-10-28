/**
 * Áp bảng giá lên tab bán hàng (pure — chạy test bằng `node --experimental-strip-types`).
 * Giá từng đơn vị lấy qua resolvePrice; dòng thu ngân đã sửa giá tay (priceEdited) không bị tính lại.
 */
import {
  isPriceBookApplicable, resolvePrice, type CatalogPriceBook, type PriceContext, type PriceResolution, type PriceWarning,
} from "../products/price-book-resolver";
import type { SaleT } from "@/messages/sale";
import type { CartLine, CatalogUnit, DraftInvoice } from "./sale-types";

const WARNING_KEY = {
  BOOK_MISSING: "priceBook.warnings.bookMissing", BOOK_NOT_APPLICABLE: "priceBook.warnings.bookNotApplicable",
  NOT_IN_BOOK_BLOCKED: "priceBook.warnings.notInBookBlocked", NOT_IN_BOOK: "priceBook.warnings.notInBook",
} as const;

/** Mã cảnh báo bảng giá → câu theo ngôn ngữ giao diện ("" khi không có cảnh báo). */
export const priceWarningText = (t: SaleT, w: PriceWarning | null) => (w ? t(WARNING_KEY[w.code], { name: w.book ?? "" }) : "");

/** Ngữ cảnh lọc bảng giá của tab: chi nhánh, nhóm của khách, người bán, thời điểm. */
export function draftPriceContext(d: DraftInvoice, branchId: string, date = new Date()): PriceContext {
  return { branchId, customerGroupId: d.customer?.groupId ?? null, sellerId: d.sellerId || null, date };
}

/** Giá của 1 đơn vị theo bảng giá đang chọn trên tab. */
export function resolveUnitPrice(books: CatalogPriceBook[], d: DraftInvoice, branchId: string, unit: CatalogUnit,
  date?: Date): PriceResolution {
  return resolvePrice(books, { ...draftPriceContext(d, branchId, date), bookId: d.priceBookId ?? null }, unit.id, unit.price);
}

/** Bảng giá đang chọn không còn dùng được (đổi khách / người bán, hết hiệu lực, bị xóa) → cần về Bảng giá chung. */
export function priceBookDropped(books: CatalogPriceBook[], d: DraftInvoice, branchId: string, date?: Date): CatalogPriceBook | "missing" | null {
  if (!d.priceBookId) return null;
  const book = books.find((b) => b.id === d.priceBookId);
  if (!book) return "missing";
  return isPriceBookApplicable(book, draftPriceContext(d, branchId, date)) ? null : book;
}

/**
 * Tính lại giá các dòng theo bảng giá bookId (dòng priceEdited giữ nguyên).
 * Hàng bị bảng giá chặn (BLOCK) → bỏ khỏi giỏ; cảnh báo gộp theo nội dung kèm tên hàng (câu theo ngôn ngữ của t).
 */
export function repriceLines(lines: CartLine[], books: CatalogPriceBook[], ctx: PriceContext, bookId: string | null, t: SaleT) {
  const warned = new Map<string, string[]>();
  const note = (msg: string, name: string) => warned.set(msg, [...(warned.get(msg) ?? []), name]);
  const out: CartLine[] = [];
  for (const l of lines) {
    if (l.priceEdited) { out.push(l); continue; }
    const unit = l.units.find((u) => u.id === l.unitId) ?? l.units[0];
    const r = resolvePrice(books, { ...ctx, bookId }, unit.id, unit.price);
    if (!r.allowed) { note(`${priceWarningText(t, r.warning)} — ${t("priceBook.removedFromCart")}`, l.productName); continue; }
    if (r.warning) note(priceWarningText(t, r.warning), l.productName);
    out.push({ ...l, unitPrice: r.price, discount: Math.min(l.discount, r.price) });
  }
  const notices = [...warned].map(([msg, names]) => `${msg}: ${names.join(", ")}`);
  return { lines: out, notices };
}

/** Tab lưu trên máy từ trước khi có bảng giá: thiếu priceBookId / priceEdited → null / false. */
export function migrateDraft(d: DraftInvoice): DraftInvoice {
  return { ...d, priceBookId: d.priceBookId ?? null, salesChannel: d.salesChannel ?? "DIRECT", lines: (d.lines ?? []).map((l) => ({ ...l, priceEdited: l.priceEdited ?? false })) };
}
