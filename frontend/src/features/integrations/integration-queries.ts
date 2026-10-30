"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

/** Kiểu + hook cho integration-service: hóa đơn đầu vào (cổng thuế / XML) và hóa đơn điện tử MISA. */

export type TaxConnection = {
  id: string; taxCode: string; username: string; active: boolean; lastSyncedAt: string | null; lastError: string | null;
};

/** nature = TChat (1 hàng hóa dịch vụ, 2 khuyến mại, 3 chiết khấu thương mại, 4 ghi chú); other = TTKhac. */
export type InputInvoiceLine = {
  code: string | null; name: string; unit: string | null; quantity: number | null; unitPrice: number | null;
  discount: number | null; amount: number | null; vatRate: string | null; nature?: string | null; other?: string | null;
};

/** Thông tin hiển thị "Chi tiết hóa đơn điện tử" (chỉ có ở GET /input-invoices/{id}). */
export type InputInvoiceDetails = {
  invoiceName: string | null; taxAuthorityCode: string | null; paymentMethod: string | null; note: string | null;
  totalInWords: string | null; sellerPhone: string | null; sellerBankAccount: string | null; sellerStoreCode: string | null;
  sellerStoreName: string | null; buyerName: string | null; buyerPersonName: string | null; buyerAddress: string | null;
  buyerPhone: string | null; buyerBudgetCode: string | null; buyerPassport: string | null; buyerIdNumber: string | null;
  buyerBankAccount: string | null; signer: string | null; signedAt: string | null;
  rates: { rate: string | null; beforeTax: number | null; tax: number | null }[];
};

export type InputInvoiceLinkType = "RECEIPT" | "SUPPLIER_PAYMENT" | "CASH_VOUCHER";

export type InputInvoice = {
  id: string; buyerTaxCode: string; sellerTaxCode: string; sellerName: string | null; sellerAddress?: string | null;
  templateNo: string; series: string; number: string; issuedAt: string; totalBeforeTax: number | null; vatAmount: number | null;
  total: number; nature: "ORIGINAL" | "REPLACE" | "ADJUST"; source: "PORTAL" | "XML";
  linkType?: InputInvoiceLinkType | null; linkId?: string | null; linkCode?: string | null;
  receiptId: string | null; receiptCode: string | null; lines: InputInvoiceLine[];
  details?: InputInvoiceDetails | null; totalInWords?: string | null;
};

export type InputInvoiceSeller = { taxCode: string; name: string | null };

export type SyncLog = {
  id: string; taxCode: string; from: string; to: string; status: "SUCCESS" | "FAILED"; found: number; added: number;
  error: string | null; userName: string | null; createdAt: string;
};

export type ItemMapping = { itemName: string; itemUnit: string | null; productId: string; unitId: string };

export type EInvoiceRecord = {
  invoice_id: string; invoice_code: string; status: "PUBLISHED" | "FAILED"; inv_series: string | null; inv_no: string | null;
  inv_code: string | null; inv_date: string | null; transaction_id: string | null; error: string | null;
};

/** Tên tiếng Việt cố định (file xuất hóa đơn đầu vào — dữ liệu thuế, giữ tiếng Việt mọi ngôn ngữ). */
export const NATURE_LABEL = { ORIGINAL: "Hóa đơn gốc", REPLACE: "Hóa đơn thay thế", ADJUST: "Hóa đơn điều chỉnh" } as const;
/** Nhãn trên màn hình (khóa namespace "input-invoices"). */
export const NATURE_KEY = {
  ORIGINAL: "nature.original", REPLACE: "nature.replace", ADJUST: "nature.adjust",
} as const;

/** Chứng từ đã lập từ hóa đơn (link mới, hoặc receipt* của dữ liệu cũ). */
export const linkOf = (i: InputInvoice) => ({ id: i.linkId ?? i.receiptId, code: i.linkCode ?? i.receiptCode });

export const useTaxConnections = () =>
  useQuery({ queryKey: ["tax-connections"], queryFn: () => api<TaxConnection[]>("/tax-connections") });

export const useInputInvoices = (params: URLSearchParams) =>
  useQuery({
    queryKey: ["input-invoices", params.toString()],
    queryFn: () => api<{ items: InputInvoice[]; total: number; sumTotal: number }>(`/input-invoices?${params}`),
    placeholderData: (prev) => prev,
  });

export const useInputInvoice = (id: string | null) =>
  useQuery({ queryKey: ["input-invoice", id], queryFn: () => api<InputInvoice>(`/input-invoices/${id}`), enabled: !!id });

export const useBuyerTaxCodes = () =>
  useQuery({ queryKey: ["input-invoice-buyers"], queryFn: () => api<string[]>("/input-invoices/buyer-tax-codes") });

export const useInputInvoiceSellers = () =>
  useQuery({ queryKey: ["input-invoice-sellers"], queryFn: () => api<InputInvoiceSeller[]>("/input-invoices/sellers") });

export const useSyncLogs = (enabled: boolean) =>
  useQuery({ queryKey: ["tax-sync-logs"], queryFn: () => api<SyncLog[]>("/tax-connections/sync-logs?limit=50"), enabled });

export const useEInvoiceRecords = (invoiceIds: string[]) =>
  useQuery({
    queryKey: ["einvoices", invoiceIds],
    queryFn: () => api<EInvoiceRecord[]>(`/einvoices?${invoiceIds.map((id) => `invoiceIds=${id}`).join("&")}`),
    enabled: invoiceIds.length > 0,
  });

/** Gắn chứng từ đã lập ("Đã lập phiếu ↗"). */
export const linkInputInvoice = (id: string, type: InputInvoiceLinkType, docId: string, code: string) =>
  api(`/input-invoices/${id}/link`, { method: "PATCH", body: { type, id: docId, code } });

/** Khóa ánh xạ hàng trên hóa đơn: tên + "|" + ĐVT, chữ thường, gộp khoảng trắng (cùng quy tắc với backend). */
const norm = (s: string | null | undefined) => (s ?? "").trim().replace(/\s+/g, " ").toLowerCase();
export const mappingKey = (name: string | null | undefined, unit: string | null | undefined) => `${norm(name)}|${norm(unit)}`;

/** Ước lượng thuế suất VAT của hóa đơn đầu vào (để điền sẵn phiếu nhập): gần nhất trong 0/5/8/10%. */
export function guessVatRate(inv: InputInvoice): number | null {
  if (!inv.totalBeforeTax || inv.vatAmount == null) return null;
  const pct = (Number(inv.vatAmount) / Number(inv.totalBeforeTax)) * 100;
  return [0, 5, 8, 10].reduce((best, r) => (Math.abs(r - pct) < Math.abs(best - pct) ? r : best), 0);
}
