import { api, type PageResponse } from "@/lib/api-client";
import { emptyEditor, type EditorState } from "@/features/purchases/purchase-editor-state";
import type { Supplier } from "@/features/purchases/purchase-types";
import { guessVatRate, type InputInvoice } from "./integration-queries";

/**
 * Chuẩn bị phiếu nhập từ 1 hóa đơn đầu vào: tìm NCC theo MST (chưa có → tạo mới từ thông tin người bán trên hóa đơn),
 * điền số hóa đơn đầu vào + thuế suất. Dòng hàng do người dùng chọn (tên hàng trên HĐ của NCC thường khác tên trong kho).
 */
export async function receiptEditorFromInputInvoice(id: string, branchId: string, personId: string) {
  const inv = await api<InputInvoice>(`/input-invoices/${id}`);
  const found = await api<PageResponse<Supplier>>(`/suppliers?q=${encodeURIComponent(inv.sellerTaxCode)}&size=5`);
  let supplier = found.items.find((s) => s.taxCode === inv.sellerTaxCode);
  if (!supplier) {
    supplier = await api<Supplier>("/suppliers", { method: "POST", body: {
      name: inv.sellerName ?? inv.sellerTaxCode, taxCode: inv.sellerTaxCode, companyName: inv.sellerName } });
  }
  const state: EditorState = {
    ...emptyEditor(branchId, personId),
    supplier: { id: supplier.id, name: supplier.name },
    inputInvoiceNo: inv.number,
    vatRate: guessVatRate(inv),
    note: `Lập từ hóa đơn đầu vào ${inv.templateNo}${inv.series} số ${inv.number}`,
  };
  return { state, reference: inv };
}
