"use client";

import { useQuery } from "@tanstack/react-query";
import { api, type PageResponse } from "@/lib/api-client";
import { periodRange, type PurchaseFilters } from "@/features/purchases/purchase-queries";
import type { IssueListItem, IssueType, StockIssue, StockTake, TakeListItem } from "./inventory-types";

/** Bộ lọc trái giống Mua hàng (Trạng thái, Thời gian, Người tạo); không dùng personId / số HĐ. */
export const defaultInventoryFilters = (statuses: string[]): PurchaseFilters => ({
  q: "", statuses, period: "month", from: "", to: "", createdBy: "", personId: "", inputInvoiceNo: "",
});

function toQuery(f: PurchaseFilters, page: number, size: number, extra: Record<string, string> = {}) {
  const p = new URLSearchParams({ ...extra, page: String(page), size: String(size) });
  if (f.q.trim()) p.set("q", f.q.trim());
  f.statuses.forEach((s) => p.append("statuses", s));
  const { from, to } = periodRange(f);
  if (from) p.set("from", from);
  if (to) p.set("to", to);
  if (f.createdBy) p.set("createdBy", f.createdBy);
  return p.toString();
}

export const useStockTakes = (f: PurchaseFilters, page: number, size: number) =>
  useQuery({
    queryKey: ["stock-takes", f, page, size],
    queryFn: () => api<PageResponse<TakeListItem>>(`/stock-takes?${toQuery(f, page, size)}`),
    placeholderData: (prev) => prev,
  });

export const useStockTake = (id: string | null) =>
  useQuery({ queryKey: ["stock-take", id], queryFn: () => api<StockTake>(`/stock-takes/${id}`), enabled: !!id });

export const useStockIssues = (type: IssueType, f: PurchaseFilters, page: number, size: number) =>
  useQuery({
    queryKey: ["stock-issues", type, f, page, size],
    queryFn: () => api<PageResponse<IssueListItem>>(`/stock-issues?${toQuery(f, page, size, { type })}`),
    placeholderData: (prev) => prev,
  });

export const useStockIssue = (type: IssueType, id: string | null) =>
  useQuery({
    queryKey: ["stock-issue", id],
    queryFn: () => api<StockIssue>(`/stock-issues/${id}?type=${type}`),
    enabled: !!id,
  });
