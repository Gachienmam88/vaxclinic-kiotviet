"use client";

import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { formatMoney } from "@/lib/format";
import type { Invoice } from "@/features/sales/sales-types";
import { toBody } from "./sale-invoice-body";
import { isNetworkError } from "./sale-storage";
import type { DraftInvoice, QueuedInvoice } from "./sale-types";
import { cartTotals, type SaleTabs } from "./use-sale-tabs";
import { useSaleInvoicePrinter } from "./use-sale-invoice-printer";
import { useSaleSettings } from "./use-sale-settings";

/** Đọc số tiền khách thanh toán bằng giọng tiếng Việt (Web Speech API); máy không hỗ trợ thì bỏ qua. */
export function speakPaid(amount: number) {
  try {
    if (amount <= 0 || typeof speechSynthesis === "undefined") return;
    const u = new SpeechSynthesisUtterance(`Khách thanh toán ${Math.round(amount)} đồng`);
    u.lang = "vi-VN";
    const vi = speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith("vi"));
    if (vi) u.voice = vi;
    speechSynthesis.speak(u);
  } catch { /* trình duyệt chặn đọc: bỏ qua */ }
}

/**
 * Thanh toán tab hóa đơn: sửa hóa đơn (PUT, cần mạng) hoặc bán mới (POST; mất mạng → hàng đợi offline, trừ hóa đơn từ
 * đơn đặt hàng). Bán xong: tự in theo Thiết lập in (số liên, gộp hàng), đọc số tiền khách trả nếu bật.
 * Trả về true khi tab đã xử lý xong (giao diện làm mới danh mục + dữ liệu bán hàng).
 */
export function useSaleInvoiceSubmit(tabs: SaleTabs, branchId: string, enqueue: (q: QueuedInvoice) => void) {
  const { settings } = useSaleSettings();
  const print = useSaleInvoicePrinter();
  return async (d: DraftInvoice, sellerName: string | undefined): Promise<boolean> => {
    const t = cartTotals(d);
    if (d.editOf) { // Lưu bản sửa hóa đơn (kho hoàn lô cũ + xuất lô mới trong 1 giao dịch)
      try {
        const inv = await api<Invoice>(`/invoices/${d.editOf.invoiceId}?revision=${d.editOf.revision}`,
          { method: "PUT", body: { ...toBody(d, branchId, sellerName, false), soldAt: undefined } });
        toast.success(`Đã cập nhật hóa đơn ${inv.code}`, { action: { label: "In hóa đơn", onClick: () => print(inv) } });
        tabs.close(d.id);
        return true;
      } catch (e) {
        toast.error(isNetworkError(e) ? "Mất kết nối: sửa hóa đơn cần có mạng, vui lòng thử lại" : (e as Error).message);
        return false;
      }
    }
    try {
      const inv = await api<Invoice>("/invoices", { method: "POST", body: toBody(d, branchId, sellerName, false) });
      toast.success(`Đã thanh toán hóa đơn ${inv.code}${inv.shipment ? ` — vận đơn ${inv.shipment.code}` : ""}${t.paid > t.due ? ` — trả lại khách ${formatMoney(t.paid - t.due)}` : ""}`,
        { duration: 8000, action: { label: "In hóa đơn", onClick: () => print(inv) } });
      if (settings.speakPaid) speakPaid(Math.min(t.paid, t.due));
      if (settings.autoPrint) print(inv);
      tabs.resetActive();
      return true;
    } catch (e) {
      if (isNetworkError(e) && d.fromOrder) { // hóa đơn từ đơn đặt hàng phải lên server ngay (đơn + tiền cọc ở server)
        toast.error("Mất kết nối: tạo hóa đơn từ đơn đặt hàng cần có mạng, vui lòng thử lại");
      } else if (isNetworkError(e)) {
        enqueue({ id: d.id, kind: "INVOICE", label: d.label, createdAt: new Date().toISOString(), body: toBody(d, branchId, sellerName, true),
          customerName: d.customer?.name ?? "Khách lẻ", total: t.total, status: "pending" });
        toast.warning("Mất kết nối: đã lưu hóa đơn trên máy, sẽ tự đồng bộ khi có mạng");
        if (settings.speakPaid) speakPaid(Math.min(t.paid, t.due));
        tabs.resetActive();
        return true;
      } else {
        toast.error((e as Error).message);
      }
      return false;
    }
  };
}
