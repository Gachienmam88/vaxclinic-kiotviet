"use client";

import { useQuery } from "@tanstack/react-query";
import { api, type PageResponse } from "@/lib/api-client";
import type {
  Category, LedgerLine, Position, ProductDetail, ProductListResponse, ProductLot, StockFilter, TaxRate,
} from "./product-types";

export type ProductFilters = {
  q: string;
  categoryIds: string[];
  taxRateIds: string[];
  taxReduction: "all" | "yes" | "no";
  stock: StockFilter;
  createdFrom: string; // yyyy-mm-dd, "" = không lọc
  createdTo: string;
  active: "all" | "yes" | "no";
};

export const EMPTY_FILTERS: ProductFilters = {
  q: "", categoryIds: [], taxRateIds: [], taxReduction: "all", stock: "ALL",
  createdFrom: "", createdTo: "", active: "yes",
};

function toQuery(f: ProductFilters, page: number, size: number) {
  const p = new URLSearchParams({ page: String(page), size: String(size), stock: f.stock });
  if (f.q.trim()) p.set("q", f.q.trim());
  f.categoryIds.forEach((id) => p.append("categoryIds", id));
  f.taxRateIds.forEach((id) => p.append("taxRateIds", id));
  if (f.taxReduction !== "all") p.set("taxReduction", String(f.taxReduction === "yes"));
  if (f.active !== "all") p.set("active", String(f.active === "yes"));
  // Ngày theo giờ địa phương → khoảng [00:00 ngày bắt đầu, 00:00 ngày sau ngày kết thúc)
  if (f.createdFrom) p.set("createdFrom", new Date(`${f.createdFrom}T00:00:00`).toISOString());
  if (f.createdTo) {
    const end = new Date(`${f.createdTo}T00:00:00`);
    end.setDate(end.getDate() + 1);
    p.set("createdTo", end.toISOString());
  }
  return p.toString();
}

export function useProducts(filters: ProductFilters, page: number, size: number) {
  return useQuery({
    queryKey: ["products", filters, page, size],
    queryFn: () => api<ProductListResponse>(`/products?${toQuery(filters, page, size)}`),
    placeholderData: (prev) => prev,
  });
}

export function useProduct(id: string | null) {
  return useQuery({
    queryKey: ["product", id],
    queryFn: () => api<ProductDetail>(`/products/${id}`),
    enabled: !!id,
  });
}

export function useProductLedger(id: string, page: number) {
  return useQuery({
    queryKey: ["product-ledger", id, page],
    queryFn: () => api<PageResponse<LedgerLine>>(`/products/${id}/ledger?page=${page}&size=10`),
  });
}

export function useProductLots(id: string, enabled: boolean) {
  return useQuery({
    queryKey: ["product-lots", id],
    queryFn: () => api<ProductLot[]>(`/products/${id}/lots`),
    enabled,
  });
}

export const useCategories = () =>
  useQuery({ queryKey: ["categories"], queryFn: () => api<Category[]>("/categories"), staleTime: 5 * 60_000 });

export const useTaxRates = () =>
  useQuery({ queryKey: ["tax-rates"], queryFn: () => api<TaxRate[]>("/tax-rates"), staleTime: 30 * 60_000 });

export const usePositions = () =>
  useQuery({ queryKey: ["positions"], queryFn: () => api<Position[]>("/positions"), staleTime: 5 * 60_000 });

/** Sắp xếp nhóm hàng thành cây phẳng có độ sâu để hiển thị thụt lề. */
export function flattenCategoryTree(categories: Category[]) {
  const children = new Map<string | null, Category[]>();
  categories.forEach((c) => children.set(c.parentId, [...(children.get(c.parentId) ?? []), c]));
  const out: (Category & { depth: number })[] = [];
  const walk = (parent: string | null, depth: number) =>
    (children.get(parent) ?? []).forEach((c) => { out.push({ ...c, depth }); walk(c.id, depth + 1); });
  walk(null, 0);
  return out;
}
