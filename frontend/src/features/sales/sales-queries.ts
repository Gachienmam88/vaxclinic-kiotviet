"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type {
  BankAccount, CashPage, Customer, CustomerList, DebtLine, Invoice, InvoiceList,
} from "./sales-types";

/** Khoảng thời gian dùng chung: "Tháng này" hoặc tùy chỉnh [from 00:00, to hết ngày] theo giờ máy. */
export type Period = { mode: "all" | "month" | "custom"; from: string; to: string };

export function periodParams(p: Period, params: URLSearchParams, fromKey = "from", toKey = "to") {
  if (p.mode === "month") {
    const now = new Date();
    params.set(fromKey, new Date(now.getFullYear(), now.getMonth(), 1).toISOString());
    params.set(toKey, new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString());
  } else if (p.mode === "custom") {
    if (p.from) params.set(fromKey, new Date(`${p.from}T00:00:00`).toISOString());
    if (p.to) {
      const end = new Date(`${p.to}T00:00:00`);
      end.setDate(end.getDate() + 1);
      params.set(toKey, end.toISOString());
    }
  }
  return params;
}

export const useCustomers = (params: URLSearchParams) =>
  useQuery({
    queryKey: ["customers", params.toString()],
    queryFn: () => api<CustomerList>(`/customers?${params}`),
    placeholderData: (prev) => prev,
  });

export const useCustomer = (id: string | null) =>
  useQuery({ queryKey: ["customer", id], queryFn: () => api<Customer>(`/customers/${id}`), enabled: !!id });

export const useCustomerDebts = (id: string) =>
  useQuery({ queryKey: ["customer-debts", id], queryFn: () => api<DebtLine[]>(`/customers/${id}/debts`) });

export const useCustomerGroups = () =>
  useQuery({ queryKey: ["customer-groups"], queryFn: () => api<string[]>("/customers/groups") });

export const useInvoices = (params: URLSearchParams) =>
  useQuery({
    queryKey: ["invoices", params.toString()],
    queryFn: () => api<InvoiceList>(`/invoices?${params}`),
    placeholderData: (prev) => prev,
  });

export const useInvoice = (id: string | null) =>
  useQuery({ queryKey: ["invoice", id], queryFn: () => api<Invoice>(`/invoices/${id}`), enabled: !!id });

export const useCashbook = (params: URLSearchParams) =>
  useQuery({
    queryKey: ["cashbook", params.toString()],
    queryFn: () => api<CashPage>(`/cashbook?${params}`),
    placeholderData: (prev) => prev,
  });

export const useCashCategories = () =>
  useQuery({ queryKey: ["cash-categories"], queryFn: () => api<string[]>("/cashbook/categories") });

export const useBankAccounts = () =>
  useQuery({ queryKey: ["bank-accounts"], queryFn: () => api<BankAccount[]>("/bank-accounts"), staleTime: 5 * 60_000 });

/** Invalidate everything a sale / payment / cancellation can change. */
export const SALES_KEYS = [["invoices"], ["invoice"], ["customers"], ["customer"], ["customer-debts"], ["cashbook"], ["products"]];
