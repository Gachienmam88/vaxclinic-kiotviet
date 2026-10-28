"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { applicablePriceBooks, type CatalogPriceBook } from "@/features/products/price-book-resolver";
import { draftPriceContext, priceBookDropped, repriceLines, resolveUnitPrice } from "./pos-price-book-pricing";
import type { CatalogUnit } from "./pos-types";
import type { PosTabs } from "./use-pos-tabs";

/**
 * Bảng giá của tab đang mở (tab hóa đơn / đặt hàng; tab trả hàng không dùng):
 * - options: bảng giá áp dụng được cho chi nhánh + nhóm khách + người bán + lúc này (ngoài "Bảng giá chung").
 * - select: đổi bảng giá → tính lại giá các dòng chưa sửa tay.
 * - resolve: giá 1 đơn vị khi thêm hàng / đổi đơn vị tính.
 * Đổi khách / người bán mà bảng giá đang chọn không còn áp dụng → về Bảng giá chung + thông báo.
 * ready = đã có danh mục (từ server hoặc bản lưu) — chưa có thì không tự đổi bảng giá đã lưu trên tab.
 */
export function usePosPriceBook(tabs: PosTabs, books: CatalogPriceBook[], branchId: string, ready: boolean) {
  const d = tabs.active;
  const usable = !!d && !d.returnOf;
  const options = usable ? applicablePriceBooks(books, draftPriceContext(d, branchId)) : [];

  const select = (bookId: string | null) => {
    if (!usable) return;
    const r = repriceLines(d.lines, books, draftPriceContext(d, branchId), bookId);
    tabs.update({ priceBookId: bookId, lines: r.lines });
    r.notices.forEach((m) => toast.warning(m));
  };

  const resolve = (unit: CatalogUnit) =>
    d ? resolveUnitPrice(books, d, branchId, unit) : { price: unit.price, allowed: true, warning: null, source: "BASE" as const };

  const groupId = d?.customer?.groupId ?? null;
  useEffect(() => {
    if (!ready || !usable) return;
    const dropped = priceBookDropped(books, d, branchId);
    if (!dropped) return;
    toast.info(dropped === "missing" ? "Bảng giá không còn tồn tại — chuyển về Bảng giá chung"
      : `Bảng giá "${dropped.name}" không áp dụng cho khách / người bán này — chuyển về Bảng giá chung`);
    select(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ kiểm tra lại khi đổi tab / khách / người bán / bảng giá
  }, [ready, d?.id, groupId, d?.sellerId, d?.priceBookId, books, branchId]);

  return { options, value: usable ? d.priceBookId ?? null : null, select, resolve };
}

export type PosPriceBook = ReturnType<typeof usePosPriceBook>;
