"use client";

import { useQuery } from "@tanstack/react-query";
import { api, type PageResponse } from "@/lib/api-client";
import type {
  ListResponse, PurchaseReturn, Receipt, ReceiptListItem, ReturnListItem, Supplier, UserLookup,
} from "./purchase-types";

/** Bộ lọc bên trái dùng chung cho Nhập hàng và Trả hàng nhập. */
export type PurchaseFilters = {
  q: string;
  statuses: string[]; // DocStatus; kiểm kho thêm BALANCED
  period: "month" | "custom";
  from: string; // yyyy-mm-dd (khi period = custom)
  to: string;
  createdBy: string;
  personId: string; // người nhập / người trả
  inputInvoiceNo: string;
};

export const DEFAULT_PURCHASE_FILTERS: PurchaseFilters = {
  q: "", statuses: ["DRAFT", "COMPLETED"], period: "month", from: "", to: "", createdBy: "", personId: "",
  inputInvoiceNo: "",
};

/** Link sâu ?code=: lọc theo mã, mọi trạng thái, toàn thời gian (phiếu cũ hơn tháng này vẫn thấy). */
export const deepLinkPurchaseFilters = (code: string): PurchaseFilters => ({
  ...DEFAULT_PURCHASE_FILTERS, q: code, statuses: ["DRAFT", "COMPLETED", "CANCELLED"], period: "custom",
});

/** Khoảng thời gian theo giờ máy: "Tháng này" hoặc [từ 00:00, đến hết ngày]. */
export function periodRange(f: PurchaseFilters): { from?: string; to?: string } {
  if (f.period === "month") {
    const now = new Date();
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
      to: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString(),
    };
  }
  const end = f.to ? new Date(`${f.to}T00:00:00`) : null;
  end?.setDate(end.getDate() + 1);
  return { from: f.from ? new Date(`${f.from}T00:00:00`).toISOString() : undefined, to: end?.toISOString() };
}

function toQuery(f: PurchaseFilters, personParam: string, page: number, size: number) {
  const p = new URLSearchParams({ page: String(page), size: String(size) });
  if (f.q.trim()) p.set("q", f.q.trim());
  f.statuses.forEach((s) => p.append("statuses", s));
  const { from, to } = periodRange(f);
  if (from) p.set("from", from);
  if (to) p.set("to", to);
  if (f.createdBy) p.set("createdBy", f.createdBy);
  if (f.personId) p.set(personParam, f.personId);
  if (f.inputInvoiceNo.trim()) p.set("inputInvoiceNo", f.inputInvoiceNo.trim());
  return p.toString();
}

export const useReceipts = (f: PurchaseFilters, page: number, size: number) =>
  useQuery({
    queryKey: ["purchase-receipts", f, page, size],
    queryFn: () => api<ListResponse<ReceiptListItem>>(`/purchase-receipts?${toQuery(f, "receiverId", page, size)}`),
    placeholderData: (prev) => prev,
  });

export const useReceipt = (id: string | null) =>
  useQuery({ queryKey: ["purchase-receipt", id], queryFn: () => api<Receipt>(`/purchase-receipts/${id}`), enabled: !!id });

export const useReturns = (f: PurchaseFilters, page: number, size: number) =>
  useQuery({
    queryKey: ["purchase-returns", f, page, size],
    queryFn: () => api<ListResponse<ReturnListItem>>(`/purchase-returns?${toQuery(f, "returnerId", page, size)}`),
    placeholderData: (prev) => prev,
  });

export const useReturn = (id: string | null) =>
  useQuery({ queryKey: ["purchase-return", id], queryFn: () => api<PurchaseReturn>(`/purchase-returns/${id}`), enabled: !!id });

/** Ô chọn NCC trên phiếu nhập: chỉ NCC đang hoạt động (NCC ngừng hoạt động không được chọn cho phiếu mới). */
export const useSuppliers = (q: string, page = 0, size = 15) =>
  useQuery({
    queryKey: ["suppliers", "picker", q, page, size],
    queryFn: () => api<PageResponse<Supplier>>(`/suppliers?q=${encodeURIComponent(q)}&active=true&page=${page}&size=${size}`),
    placeholderData: (prev) => prev,
  });

export const useUserLookup = () =>
  useQuery({ queryKey: ["user-lookup"], queryFn: () => api<UserLookup[]>("/users/lookup"), staleTime: 5 * 60_000 });
