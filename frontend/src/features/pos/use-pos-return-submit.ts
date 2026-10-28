"use client";

import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { formatMoney } from "@/lib/format";
import { returnTotals } from "./pos-return-panel";
import { isNetworkError } from "./pos-storage";
import type { DraftInvoice, QueuedInvoice } from "./pos-types";

/** Body POST /sales-returns: theo hóa đơn (invoiceLineId) hoặc Trả nhanh (productId + unitId + giá trả + lô). */
export function returnBody(d: DraftInvoice, branchId: string) {
  const t = returnTotals(d);
  const base = { id: d.id, discount: t.discount, fee: t.fee, refundAmount: t.refund, paymentMethod: d.paymentMethod, note: d.note,
    returnedAt: new Date().toISOString() };
  if (d.returnOf) {
    return { ...base, invoiceId: d.returnOf.invoiceId,
      lines: d.returnOf.lines.filter((l) => l.quantity > 0).map((l) => ({ invoiceLineId: l.invoiceLineId, quantity: l.quantity })) };
  }
  return { ...base, invoiceId: null, branchId, customerId: d.customer?.id ?? null,
    lines: d.lines.filter((l) => l.quantity > 0).map((l) => ({ productId: l.productId, unitId: l.unitId, quantity: l.quantity,
      unitPrice: l.unitPrice - l.discount, lotNumber: l.lotNumber || null })) };
}

/** Kiểm tra trước khi gửi phiếu trả; null = hợp lệ. lotManaged: hàng quản lý theo lô (Trả nhanh phải chọn lô). */
export function returnProblem(d: DraftInvoice, lotManaged: (productId: string) => boolean): string | null {
  const t = returnTotals(d);
  if (t.qty <= 0) return "Chưa chọn hàng trả";
  if (!d.customer && t.refund < t.total) return "Khách lẻ: phải trả đủ tiền cho khách";
  const noLot = d.quickReturn && d.lines.find((l) => lotManaged(l.productId) && !l.lotNumber);
  return noLot ? `${noLot.productName}: chọn lô hàng trả` : null;
}

/**
 * Gửi phiếu trả hàng. Mất mạng → xếp hàng offline (server bỏ qua bản gửi lại cùng id) và đóng tab.
 * Trả về true khi tab đã xử lý xong (thành công hoặc đã xếp hàng).
 */
export async function submitReturnDoc(d: DraftInvoice, branchId: string, enqueue: (q: QueuedInvoice) => void): Promise<boolean> {
  const body = returnBody(d, branchId);
  const t = returnTotals(d);
  try {
    const r = await api<{ code: string }>("/sales-returns", { method: "POST", body });
    toast.success(`Đã tạo phiếu trả hàng ${r.code}${t.refund > 0 ? ` — trả khách ${formatMoney(t.refund)}` : ""}`);
    return true;
  } catch (e) {
    if (!isNetworkError(e)) { toast.error((e as Error).message); return false; }
    enqueue({ id: d.id, kind: "RETURN", label: d.label, createdAt: new Date().toISOString(), body,
      customerName: d.customer?.name ?? "Khách lẻ", total: t.total, status: "pending" });
    toast.warning("Mất kết nối: đã lưu phiếu trả hàng trên máy, sẽ tự đồng bộ khi có mạng");
    return true;
  }
}
