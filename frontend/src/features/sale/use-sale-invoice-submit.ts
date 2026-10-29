"use client";

import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { useLocale, useT, type Locale } from "@/lib/i18n";
import { interpolate } from "@/lib/i18n/translate";
import { formatMoney } from "@/lib/format";
import { saleNs } from "@/messages/sale";
import type { Invoice } from "@/features/sales/sales-types";
import { toBody } from "./sale-invoice-body";
import { isNetworkError } from "./sale-storage";
import type { DraftInvoice, QueuedInvoice } from "./sale-types";
import { cartTotals, type SaleTabs } from "./use-sale-tabs";
import { useSaleInvoicePrinter } from "./use-sale-invoice-printer";
import { useSaleSettings } from "./use-sale-settings";

const SPEECH_LANG: Record<Locale, string> = { vi: "vi-VN", en: "en-US", ja: "ja-JP", zh: "zh-CN" };

/**
 * Đọc số tiền khách thanh toán (Web Speech API) bằng ngôn ngữ giao diện nếu máy có giọng đọc ngôn ngữ đó,
 * không có thì đọc câu tiếng Việt (giọng vi nếu có). Máy không hỗ trợ / chặn đọc thì bỏ qua.
 */
export function speakPaid(amount: number, locale: Locale, text: string) {
  try {
    if (amount <= 0 || typeof speechSynthesis === "undefined") return;
    const voices = speechSynthesis.getVoices();
    const voiceOf = (l: Locale) => voices.find((v) => v.lang.toLowerCase().startsWith(l));
    const local = locale !== "vi" ? voiceOf(locale) : undefined;
    const vars = { amount: Math.round(amount) };
    const u = new SpeechSynthesisUtterance(local ? interpolate(text, vars) : interpolate(saleNs.vi.checkout.speakPaid, vars));
    u.lang = SPEECH_LANG[local ? locale : "vi"];
    const voice = local ?? voiceOf("vi");
    if (voice) u.voice = voice;
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
  const tr = useT(saleNs);
  const locale = useLocale();
  const speak = (amount: number) => speakPaid(amount, locale, tr("checkout.speakPaid"));
  return async (d: DraftInvoice, sellerName: string | undefined): Promise<boolean> => {
    const t = cartTotals(d);
    if (d.editOf) { // Lưu bản sửa hóa đơn (kho hoàn lô cũ + xuất lô mới trong 1 giao dịch)
      try {
        const inv = await api<Invoice>(`/invoices/${d.editOf.invoiceId}?revision=${d.editOf.revision}`,
          { method: "PUT", body: { ...toBody(d, branchId, sellerName, false), soldAt: undefined } });
        toast.success(tr("invoice.updated", { code: inv.code }), { action: { label: tr("invoice.print"), onClick: () => print(inv) } });
        tabs.close(d.id);
        return true;
      } catch (e) {
        toast.error(isNetworkError(e) ? tr("invoice.editNeedsNetwork") : (e as Error).message);
        return false;
      }
    }
    try {
      const inv = await api<Invoice>("/invoices", { method: "POST", body: toBody(d, branchId, sellerName, false) });
      const parts = [tr("invoice.paid", { code: inv.code })];
      if (inv.shipment) parts.push(tr("invoice.shipment", { code: inv.shipment.code }));
      if (t.paid > t.due) parts.push(tr("invoice.change", { amount: formatMoney(t.paid - t.due) }));
      toast.success(parts.join(" — "), { duration: 8000, action: { label: tr("invoice.print"), onClick: () => print(inv) } });
      if (settings.speakPaid) speak(Math.min(t.paid, t.due));
      if (settings.autoPrint) print(inv); // hóa đơn giao hàng in bằng mẫu in giao hàng
      tabs.resetActive();
      return true;
    } catch (e) {
      if (isNetworkError(e) && d.fromOrder) { // hóa đơn từ đơn đặt hàng phải lên server ngay (đơn + tiền cọc ở server)
        toast.error(tr("invoice.fromOrderNeedsNetwork"));
      } else if (isNetworkError(e)) {
        enqueue({ id: d.id, kind: "INVOICE", label: d.label, createdAt: new Date().toISOString(), body: toBody(d, branchId, sellerName, true),
          customerName: d.customer?.name ?? tr("common.walkIn"), total: t.total, status: "pending" });
        toast.warning(tr("invoice.savedOffline"));
        if (settings.speakPaid) speak(Math.min(t.paid, t.due));
        tabs.resetActive();
        return true;
      } else {
        toast.error((e as Error).message);
      }
      return false;
    }
  };
}
