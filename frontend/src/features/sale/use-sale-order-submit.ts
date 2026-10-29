"use client";

import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { useT } from "@/lib/i18n";
import { formatMoney } from "@/lib/format";
import { saleNs } from "@/messages/sale";
import type { Order } from "@/features/orders/order-types";
import { SALES_KEYS } from "@/features/sales/sales-queries";
import { toBody } from "./sale-invoice-body";
import { draftFromOrder } from "./sale-open-order";
import { isNetworkError } from "./sale-storage";
import { focusCustomerSearch } from "./use-sale-shortcuts";
import type { CatalogProduct, DraftInvoice, QueuedInvoice } from "./sale-types";
import { cartTotals, type SaleTabs } from "./use-sale-tabs";

/**
 * Lưu tab "Đặt hàng": POST /orders (đơn mới, Phiếu tạm) hoặc PUT /orders/{id} (sửa đơn đã lưu).
 * Đơn mới mất mạng → xếp hàng offline (POST /orders bỏ qua bản gửi lại cùng id). Sửa đơn đã lưu cần mạng.
 */
export function useSaleOrderSubmit(tabs: SaleTabs, branchId: string, enqueue: (q: QueuedInvoice) => void) {
  const qc = useQueryClient();
  const tr = useT(saleNs);
  return async (d: DraftInvoice, sellerName: string | undefined) => {
    if (!d.customer) { // KiotViet: báo lỗi và đưa con trỏ vào ô tìm khách
      toast.error(tr("order.customerRequired"));
      focusCustomerSearch();
      return;
    }
    const t = cartTotals(d);
    const body = toBody(d, branchId, sellerName, false);
    try {
      const o = d.orderOf
        ? await api<Order>(`/orders/${d.orderOf.orderId}`, { method: "PUT", body })
        : await api<Order>("/orders", { method: "POST", body });
      const paid = Math.min(t.paid, t.due);
      const msg = tr(d.orderOf ? "order.updated" : "order.created", { code: o.code });
      toast.success(paid > 0 ? tr("order.withDeposit", { message: msg, amount: formatMoney(paid) }) : msg);
      if (d.orderOf) tabs.close(d.id); else tabs.resetActive();
      SALES_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: k }));
    } catch (e) {
      if (isNetworkError(e) && !d.orderOf) {
        enqueue({ id: d.id, kind: "ORDER", label: d.label, createdAt: new Date().toISOString(), body,
          customerName: d.customer.name, total: t.total, status: "pending" });
        toast.warning(tr("order.savedOffline"));
        tabs.resetActive();
      } else {
        toast.error(isNetworkError(e) ? tr("order.editNeedsNetwork") : (e as Error).message);
      }
    }
  };
}

/**
 * TẠO HÓA ĐƠN ở tab đơn đã lưu ("DHxxx", KiotViet): lưu thay đổi của đơn (PUT; "Khách thanh toán" nhập ở đây là cọc thêm),
 * rồi thay tab bằng tab hóa đơn "Hóa đơn N" gắn đơn — tiền cọc trừ vào khách cần trả, THANH TOÁN mới tạo hóa đơn và trừ kho.
 */
export function useSaleOrderToInvoice(tabs: SaleTabs, branchId: string, catalog: CatalogProduct[], userId: string) {
  const qc = useQueryClient();
  const tr = useT(saleNs);
  return async (d: DraftInvoice, sellerName: string | undefined) => {
    if (!d.orderOf) return;
    try {
      await api<Order>(`/orders/${d.orderOf.orderId}`, { method: "PUT", body: toBody(d, branchId, sellerName, false) });
      const inv = await draftFromOrder(d.orderOf.orderId, "invoice", catalog, userId, tr);
      tabs.replaceActive((label) => ({ ...inv, label }));
      SALES_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: k }));
    } catch (e) {
      toast.error(isNetworkError(e) ? tr("order.editNeedsNetwork") : (e as Error).message);
    }
  };
}
