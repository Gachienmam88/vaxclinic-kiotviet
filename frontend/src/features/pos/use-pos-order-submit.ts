"use client";

import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { formatMoney } from "@/lib/format";
import type { Order } from "@/features/orders/order-types";
import { SALES_KEYS } from "@/features/sales/sales-queries";
import { toBody } from "./pos-invoice-body";
import { isNetworkError } from "./pos-storage";
import type { DraftInvoice } from "./pos-types";
import { cartTotals, type PosTabs } from "./use-pos-tabs";

/**
 * Lưu tab "Đặt hàng": POST /orders (đơn mới, Phiếu tạm) hoặc PUT /orders/{id} (sửa đơn đã lưu).
 * Đặt hàng luôn cần mạng (không xếp hàng offline như hóa đơn) — mất mạng báo lỗi, giữ nguyên giỏ hàng.
 */
export function usePosOrderSubmit(tabs: PosTabs, branchId: string) {
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
      toast.error(isNetworkError(e) ? "Mất kết nối: đặt hàng cần có mạng, vui lòng thử lại" : (e as Error).message);
    }
  };
}
