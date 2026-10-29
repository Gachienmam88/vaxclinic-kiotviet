"use client";

import { DocCodeLink } from "@/components/ui/doc-code-link";
import { StatusBadge } from "@/features/sales/invoice-list-kit";
import { formatDateTime, formatMoney } from "@/lib/format";
import type { TFunction } from "@/lib/i18n";
import { ordersNs } from "@/messages/orders";
import { ORDER_STATUS_KEY, ORDER_STATUS_TONE, type OrderListItem } from "./order-types";

type OT = TFunction<typeof ordersNs.vi>;
export type OrderColumn = "orderedAt" | "customerCode" | "customer" | "phone" | "seller" | "createdBy" | "channel" | "expectedDeliveryAt"
  | "invoiceCode" | "subtotal" | "discount" | "total" | "deposit" | "status";

/** Cột chọn được (Mã đặt hàng luôn hiện); mặc định như KiotViet: Thời gian, Mã KH, Khách hàng, Khách cần trả, Khách đã trả, Trạng thái. */
export const ORDER_COLUMNS: OrderColumn[] = ["orderedAt", "customerCode", "customer", "phone", "seller", "createdBy", "channel",
  "expectedDeliveryAt", "invoiceCode", "subtotal", "discount", "total", "deposit", "status"];
export const DEFAULT_ORDER_COLUMNS: OrderColumn[] = ["orderedAt", "customerCode", "customer", "total", "deposit", "status"];
export const ORDER_MONEY = new Set<OrderColumn>(["subtotal", "discount", "total", "deposit"]);

export function orderValue(t: OT, o: OrderListItem, c: OrderColumn | "code", channel: (code: string) => string): string | number {
  switch (c) {
    case "code": return o.code;
    case "orderedAt": return formatDateTime(o.orderedAt);
    case "customerCode": return o.customerCode ?? "";
    case "customer": return o.customerName;
    case "phone": return o.customerPhone ?? "";
    case "seller": return o.sellerName ?? "";
    case "createdBy": return o.createdByName;
    case "channel": return channel(o.salesChannel);
    case "expectedDeliveryAt": return o.expectedDeliveryAt ? formatDateTime(o.expectedDeliveryAt) : "";
    case "invoiceCode": return o.invoiceCode ?? "";
    case "subtotal": return Number(o.subtotal);
    case "discount": return Number(o.discount);
    case "total": return Number(o.total);
    case "deposit": return Number(o.deposit);
    case "status": return t(ORDER_STATUS_KEY[o.status]);
  }
}

export function orderCell(t: OT, o: OrderListItem, c: OrderColumn, channel: (code: string) => string) {
  switch (c) {
    case "customerCode": return o.customerCode ? <DocCodeLink code={o.customerCode} kind="/customers" /> : "";
    case "invoiceCode": return o.invoiceCode ? <DocCodeLink code={o.invoiceCode} kind="/invoices" /> : "";
    case "status": return <StatusBadge tone={ORDER_STATUS_TONE[o.status]}>{t(ORDER_STATUS_KEY[o.status])}</StatusBadge>;
    default: {
      const v = orderValue(t, o, c, channel);
      return ORDER_MONEY.has(c) ? formatMoney(Number(v)) : v;
    }
  }
}
