import { api, type PageResponse } from "@/lib/api-client";
import type { Supplier } from "@/features/purchases/purchase-types";
import { mappingKey, type InputInvoice, type ItemMapping } from "./integration-queries";

/**
 * Bàn giao "Xác nhận dữ liệu từ hóa đơn điện tử" → màn soạn phiếu nhập (/purchases/receipts/new?source=inputInvoice&id=…):
 * NCC, số HĐ đầu vào, ghi chú và các dòng đã ánh xạ (SL / đơn giá / giảm giá mỗi đơn vị / VAT% từ hóa đơn).
 */
export type InputInvoiceReceiptDraft = {
  invoiceId: string; supplier: { id: string; name: string } | null; inputInvoiceNo: string; note: string;
  lines: { productId: string; unitId: string; quantity: number; unitPrice: number; discount: number; vatRate: number | null }[];
};

const storageKey = (invoiceId: string) => `input-invoice-receipt:${invoiceId}`;

export function saveInputInvoiceReceiptDraft(d: InputInvoiceReceiptDraft): void {
  try {
    sessionStorage.setItem(storageKey(d.invoiceId), JSON.stringify(d));
  } catch { /* chế độ riêng tư / bộ nhớ đầy: màn soạn sẽ dựng lại từ hóa đơn + ánh xạ đã nhớ */ }
}

/** "5%" → 5, "10%" → 10, "0%" → 0; "KCT" / "KKKNT" / rỗng → null (không chịu thuế). */
export function parseInvoiceVatRate(s: string | null): number | null {
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*%?\s*$/.exec(s ?? "");
  return m ? Number(m[1].replace(",", ".")) : null;
}

export const invoiceReceiptNote = (inv: InputInvoice) => `Lập từ hóa đơn đầu vào ${inv.templateNo ?? ""}${inv.series} số ${inv.number}`;

/** NCC trong hệ thống có MST = MST người bán (null nếu chưa có). */
export async function findSupplierByTaxCode(taxCode: string): Promise<Supplier | null> {
  const found = await api<PageResponse<Supplier>>(`/suppliers?q=${encodeURIComponent(taxCode)}&size=5`);
  return found.items.find((s) => s.taxCode === taxCode) ?? null;
}

/** Đọc bản bàn giao trong sessionStorage; mở trực tiếp link (tab mới / tải lại) → dựng lại từ hóa đơn + ánh xạ đã nhớ. */
export async function loadInputInvoiceReceiptDraft(invoiceId: string): Promise<InputInvoiceReceiptDraft> {
  try {
    const raw = sessionStorage.getItem(storageKey(invoiceId));
    if (raw) return JSON.parse(raw) as InputInvoiceReceiptDraft;
  } catch { /* bỏ qua, dựng lại bên dưới */ }
  const inv = await api<InputInvoice>(`/input-invoices/${invoiceId}`);
  const [maps, supplier] = await Promise.all([
    api<ItemMapping[]>(`/input-invoices/item-mappings?sellerTaxCode=${encodeURIComponent(inv.sellerTaxCode)}`),
    findSupplierByTaxCode(inv.sellerTaxCode),
  ]);
  const byKey = new Map(maps.map((m) => [mappingKey(m.itemName, m.itemUnit), m]));
  const lines = inv.lines.flatMap((l) => {
    const m = byKey.get(mappingKey(l.name, l.unit));
    if (!m) return [];
    const qty = Number(l.quantity ?? 1) || 1;
    return [{ productId: m.productId, unitId: m.unitId, quantity: qty, unitPrice: Number(l.unitPrice ?? 0),
      discount: Number(l.discount ?? 0) / qty, vatRate: parseInvoiceVatRate(l.vatRate) }];
  });
  return { invoiceId, supplier: supplier ? { id: supplier.id, name: supplier.name } : null, inputInvoiceNo: inv.number,
    note: invoiceReceiptNote(inv), lines };
}
