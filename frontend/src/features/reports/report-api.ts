"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { apiRange, type DateRange } from "./report-time-presets";

/** Kiểu dữ liệu các API /reports/** (sales-service + product-service) và hook tải chung. */

export type DocRow = {
  kind: "INVOICE" | "RETURN"; id: string; code: string; time: string; customerName: string | null; sellerName: string | null;
  qty: number; subtotal: number; discount: number; revenue: number; fee: number; paid: number; debt: number;
  method: string | null; bankLabel: string | null;
};
export type VoucherRow = {
  id: string; code: string; time: string; voucherType: "RECEIPT" | "PAYMENT"; fund: string; bankLabel: string | null;
  category: string; partnerName: string | null; collectorName: string | null; createdByName: string | null; amount: number; sourceType: string;
};
export type SummaryRow = {
  key: string; code: string; name: string; invoiceCount: number; returnCount: number; qty: number; subtotal: number;
  discount: number; revenue: number; returnValue: number; fee: number; cogs: number;
};
export type ProductRow = {
  key: string; productId: string; code: string; name: string; unit: string | null; dimKey: string; dimName: string;
  qtySold: number; revenue: number; qtyReturned: number; returnValue: number; cogs: number;
};
export type OrderProductRow = { key: string; productId: string; code: string; name: string; unit: string | null; qty: number; value: number; invoicedQty: number; orderCount: number };
export type OrderRow = {
  id: string; code: string; orderedAt: string; customerName: string; status: string; qty: number; subtotal: number;
  discount: number; total: number; deposit: number; invoiceCode: string | null;
};
export type DebtRow = { customerId?: string; supplierId?: string; code: string; name: string; phone: string | null; opening: number; debit: number; credit: number; closing: number };
export type MonthRow = {
  month: string; sales: number; invoiceDiscount: number; returnValue: number; cogs: number; returnFee: number;
  paymentDiscount: number; salary: number; otherExpense: number; otherIncome: number;
};
export type MovementRow = { productId: string; code: string; name: string; unit: string; docType: string; qty: number; value: number };
export type DamageRow = { productId: string; code: string; name: string; unit: string; qty: number; value: number; docCount: number };
export type SupplierRow = {
  supplierId: string | null; supplierCode: string | null; supplierName: string; productId: string | null; productCode: string | null;
  productName: string | null; unit: string | null; qtyIn: number; valueIn: number; qtyReturned: number; valueReturned: number; receiptCount: number;
};

/** Bộ lọc gửi kèm (rỗng / undefined thì bỏ). Mảng → lặp tham số. */
export type ReportParams = Record<string, string | string[] | boolean | undefined | null>;

export function buildQuery(range: DateRange, extra: ReportParams = {}) {
  const p = new URLSearchParams(apiRange(range));
  Object.entries(extra).forEach(([k, v]) => {
    if (Array.isArray(v)) v.filter(Boolean).forEach((x) => p.append(k, x));
    else if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  });
  return p.toString();
}

/** Tải 1 báo cáo; key gồm đường dẫn + tham số → đổi bộ lọc là tải lại. */
export function useReport<T>(path: string, range: DateRange, extra: ReportParams = {}, enabled = true) {
  const qs = buildQuery(range, extra);
  return useQuery({
    queryKey: ["report", path, qs], enabled, staleTime: 30_000,
    queryFn: () => api<T>(`${path}?${qs}`),
  });
}

/** Cộng 1 trường số của danh sách. */
export const sumOf = <T,>(rows: T[], f: (r: T) => number) => rows.reduce((s, r) => s + Number(f(r) || 0), 0);

export const PAYMENT_METHODS: [string, string][] = [["CASH", "Tiền mặt"], ["TRANSFER", "Chuyển khoản"], ["CARD", "Thẻ"], ["EWALLET", "Ví điện tử"]];
export const SALE_MODES: [string, string][] = [["QUICK", "Bán nhanh"], ["NORMAL", "Bán thường"], ["DELIVERY", "Bán giao hàng"]];
