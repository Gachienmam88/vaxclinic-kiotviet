"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type PageResponse } from "@/lib/api-client";
import type {
  CustomerGroupRef, FormulaRequest, ImportResult, PriceBook, PriceBookRequest, PriceRow, PriceRowFilters,
} from "./price-book-types";

export const EMPTY_PRICE_FILTERS: PriceRowFilters = { q: "", categoryIds: [], stock: "ALL", inBookOnly: false };

export const usePriceBooks = () =>
  useQuery({ queryKey: ["price-books"], queryFn: () => api<PriceBook[]>("/price-books") });

/** Nhóm khách hàng (sales-service). Lỗi được giữ nguyên để form hiển thị trạng thái lỗi, không dùng dữ liệu giả. */
export const useCustomerGroupRefs = () =>
  useQuery({
    queryKey: ["customer-groups"],
    queryFn: () => api<CustomerGroupRef[]>("/customer-groups"),
    staleTime: 5 * 60_000,
    retry: 1,
  });

export function usePriceRows(bookIds: string[], f: PriceRowFilters, page: number, size: number) {
  const p = new URLSearchParams({ page: String(page), size: String(size), stock: f.stock });
  bookIds.forEach((id) => p.append("bookIds", id));
  if (f.q.trim()) p.set("q", f.q.trim());
  f.categoryIds.forEach((id) => p.append("categoryIds", id));
  if (f.inBookOnly) p.set("inBookOnly", "true");
  return useQuery({
    queryKey: ["price-rows", bookIds, f, page, size],
    queryFn: () => api<PageResponse<PriceRow>>(`/price-books/items?${p}`),
    placeholderData: (prev) => prev,
  });
}

/** Sau mọi thay đổi giá: làm mới bảng + số hàng trong từng bảng giá. */
function useInvalidate() {
  const qc = useQueryClient();
  return () => Promise.all([
    qc.invalidateQueries({ queryKey: ["price-rows"] }),
    qc.invalidateQueries({ queryKey: ["price-books"] }),
  ]);
}

export function useSavePriceBook() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: PriceBookRequest }) =>
      api<PriceBook>(id ? `/price-books/${id}` : "/price-books", { method: id ? "PUT" : "POST", body }),
    onSuccess: invalidate,
  });
}

export function useDeletePriceBook() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/price-books/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}

/** price = null → bỏ hàng khỏi bảng giá. */
export function useSetPrices() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ bookId, items }: { bookId: string; items: { unitId: string; price: number | null }[] }) =>
      api<{ updated: number }>(`/price-books/${bookId}/items`, { method: "PUT", body: { items } }),
    onSuccess: invalidate,
  });
}

export function useApplyFormula() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ bookId, body }: { bookId: string; body: FormulaRequest }) =>
      api<{ updated: number }>(`/price-books/${bookId}/items/apply-formula`, { method: "POST", body }),
    onSuccess: invalidate,
  });
}

export function useImportPrices() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ bookId, rows }: { bookId: string; rows: { line: number; code: string; price: string }[] }) =>
      api<ImportResult>(`/price-books/${bookId}/items/import`, { method: "POST", body: { rows } }),
    onSuccess: invalidate,
  });
}
