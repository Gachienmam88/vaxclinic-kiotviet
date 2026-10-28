"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type {
  SupplierDebtDoc, SupplierFilters, SupplierGroup, SupplierHistoryRow, SupplierLedgerRow, SupplierPage, SupplierRow, UnpaidReceipt,
} from "./supplier-types";

/** Mọi query cần làm mới sau khi ghi NCC / công nợ NCC (danh sách, chi tiết, sổ nợ, phiếu nhập, Sổ quỹ). */
const SUPPLIER_KEYS = [["suppliers"], ["supplier"], ["supplier-groups"], ["supplier-debts"], ["supplier-history"],
  ["supplier-unpaid"], ["supplier-doc"], ["purchase-receipts"], ["purchase-receipt"], ["cashbook"]];

export function useInvalidateSuppliers() {
  const qc = useQueryClient();
  return () => SUPPLIER_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: k }));
}

/** Bộ lọc sidebar → query string của GET /suppliers. */
export function supplierParams(q: string, f: SupplierFilters, page: number, size: number) {
  const p = new URLSearchParams({ page: String(page), size: String(size) });
  if (q.trim()) p.set("q", q.trim());
  if (f.groupId) p.set("groupId", f.groupId);
  if (f.status) p.set("active", String(f.status === "active"));
  if (f.buyFrom) p.set("buyFrom", f.buyFrom);
  if (f.buyTo) p.set("buyTo", f.buyTo);
  if (f.debtFrom) p.set("debtFrom", f.debtFrom);
  if (f.debtTo) p.set("debtTo", f.debtTo);
  if (f.buyPeriod === "custom") {
    if (f.from) p.set("from", new Date(`${f.from}T00:00:00`).toISOString());
    if (f.to) {
      const end = new Date(`${f.to}T00:00:00`);
      end.setDate(end.getDate() + 1);
      p.set("to", end.toISOString());
    }
  }
  return p.toString();
}

export const useSupplierList = (query: string) =>
  useQuery({ queryKey: ["suppliers", "list", query], queryFn: () => api<SupplierPage>(`/suppliers?${query}`), placeholderData: (prev) => prev });

export const useSupplier = (id: string) =>
  useQuery({ queryKey: ["supplier", id], queryFn: () => api<SupplierRow>(`/suppliers/${id}`) });

export const useSupplierGroups = () =>
  useQuery({ queryKey: ["supplier-groups"], queryFn: () => api<SupplierGroup[]>("/suppliers/groups") });

export const useSupplierDebts = (id: string) =>
  useQuery({ queryKey: ["supplier-debts", id], queryFn: () => api<SupplierLedgerRow[]>(`/suppliers/${id}/debts`) });

export const useSupplierHistory = (id: string) =>
  useQuery({ queryKey: ["supplier-history", id], queryFn: () => api<SupplierHistoryRow[]>(`/suppliers/${id}/history`) });

export const useUnpaidReceipts = (id: string, enabled = true) =>
  useQuery({ queryKey: ["supplier-unpaid", id], queryFn: () => api<UnpaidReceipt[]>(`/suppliers/${id}/unpaid-receipts`), enabled });

export const useSupplierDoc = (docId: string) =>
  useQuery({ queryKey: ["supplier-doc", docId], queryFn: () => api<SupplierDebtDoc>(`/suppliers/debt-docs/${docId}`) });
