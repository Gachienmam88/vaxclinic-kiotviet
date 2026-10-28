"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

/** Kiểu + hook cho integration-service: hóa đơn đầu vào (cổng thuế / XML) và hóa đơn điện tử MISA. */

export type TaxConnection = {
  id: string; taxCode: string; username: string; active: boolean; lastSyncedAt: string | null; lastError: string | null;
};

export type InputInvoiceLine = {
  code: string | null; name: string; unit: string | null; quantity: number | null; unitPrice: number | null;
  discount: number | null; amount: number | null; vatRate: string | null;
};

export type InputInvoice = {
  id: string; buyerTaxCode: string; sellerTaxCode: string; sellerName: string | null; templateNo: string; series: string;
  number: string; issuedAt: string; totalBeforeTax: number | null; vatAmount: number | null; total: number;
  nature: "ORIGINAL" | "REPLACE" | "ADJUST"; source: "PORTAL" | "XML"; receiptId: string | null; receiptCode: string | null;
  lines: InputInvoiceLine[];
};

export type EInvoiceRecord = {
  invoice_id: string; invoice_code: string; status: "PUBLISHED" | "FAILED"; inv_series: string | null; inv_no: string | null;
  inv_code: string | null; inv_date: string | null; transaction_id: string | null; error: string | null;
};

/** Tên tiếng Việt cố định (file CSV hóa đơn đầu vào — dữ liệu thuế, giữ tiếng Việt mọi ngôn ngữ). */
export const NATURE_LABEL = { ORIGINAL: "Hóa đơn gốc", REPLACE: "Hóa đơn thay thế", ADJUST: "Hóa đơn điều chỉnh" } as const;
/** Nhãn trên màn hình (khóa namespace "purchases"). */
export const NATURE_KEY = {
  ORIGINAL: "inputInvoices.nature.original", REPLACE: "inputInvoices.nature.replace", ADJUST: "inputInvoices.nature.adjust",
} as const;

export const useTaxConnections = () =>
  useQuery({ queryKey: ["tax-connections"], queryFn: () => api<TaxConnection[]>("/tax-connections") });

export const useInputInvoices = (params: URLSearchParams) =>
  useQuery({
    queryKey: ["input-invoices", params.toString()],
    queryFn: () => api<{ items: InputInvoice[]; total: number; sumTotal: number }>(`/input-invoices?${params}`),
    placeholderData: (prev) => prev,
  });

export const useBuyerTaxCodes = () =>
  useQuery({ queryKey: ["input-invoice-buyers"], queryFn: () => api<string[]>("/input-invoices/buyer-tax-codes") });

export const useEInvoiceRecords = (invoiceIds: string[]) =>
  useQuery({
    queryKey: ["einvoices", invoiceIds],
    queryFn: () => api<EInvoiceRecord[]>(`/einvoices?${invoiceIds.map((id) => `invoiceIds=${id}`).join("&")}`),
    enabled: invoiceIds.length > 0,
  });

/** Ước lượng thuế suất VAT của hóa đơn đầu vào (để điền sẵn phiếu nhập): gần nhất trong 0/5/8/10%. */
export function guessVatRate(inv: InputInvoice): number | null {
  if (!inv.totalBeforeTax || inv.vatAmount == null) return null;
  const pct = (Number(inv.vatAmount) / Number(inv.totalBeforeTax)) * 100;
  return [0, 5, 8, 10].reduce((best, r) => (Math.abs(r - pct) < Math.abs(best - pct) ? r : best), 0);
}
