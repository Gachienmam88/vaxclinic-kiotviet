"use client";

import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { formatMoney } from "@/lib/format";
import type { Order } from "@/features/orders/order-types";
import { SALES_KEYS } from "@/features/sales/sales-queries";
import { toBody } from "./sale-invoice-body";
import { isNetworkError } from "./sale-storage";
import type { DraftInvoice, QueuedInvoice } from "./sale-types";
import { cartTotals, type SaleTabs } from "./use-sale-tabs";

/**
 * Lưu tab "Đặt hàng": POST /orders (đơn mới, Phiếu tạm) hoặc PUT /orders/{id} (sửa đơn đã lưu).
 * Đơn mới mất mạng → xếp hàng offline (POST /orders bỏ qua bản gửi lại cùng id). Sửa đơn đã lưu cần mạng.
 */
export function useSaleOrderSubmit(tabs: SaleTabs, branchId: string, enqueue: (q: QueuedInvoice) => void) {
  const qc = useQueryClient();
  return async (d: DraftInvoice, sellerName: string | undefined) => {
    if (!d.customer) { toast.error("Đặt hàng phải chọn khách hàng (F4)"); return; }
    const t = cartTotals(d);
    const body = toBody(d, branchId, sellerName, false);
    try {
      const o = d.orderOf
        ? await api<Order>(`/orders/${d.orderOf.orderId}`, { method: "PUT", body })
        : await api<Order>("/orders", { method: "POST", body });
      const paid = Math.min(t.paid, t.due);
      toast.success(`${d.orderOf ? "Đã cập nhật" : "Đã tạo"} đơn đặt hàng ${o.code}${paid > 0 ? ` — thu đặt cọc ${formatMoney(paid)}` : ""}`);
      if (d.orderOf) tabs.close(d.id); else tabs.resetActive();
      SALES_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: k }));
    } catch (e) {
      if (isNetworkError(e) && !d.orderOf) {
        enqueue({ id: d.id, kind: "ORDER", label: d.label, createdAt: new Date().toISOString(), body,
          customerName: d.customer.name, total: t.total, status: "pending" });
        toast.warning("Mất kết nối: đã lưu đơn đặt hàng trên máy, sẽ tự đồng bộ khi có mạng");
        tabs.resetActive();
      } else {
        toast.error(isNetworkError(e) ? "Mất kết nối: sửa đơn đặt hàng cần có mạng, vui lòng thử lại" : (e as Error).message);
      }
    }
  };
}
