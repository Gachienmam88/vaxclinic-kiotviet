"use client";

import { DocCodeLink } from "@/components/ui/doc-code-link";
import { StatusBadge } from "@/features/sales/invoice-list-kit";
import { formatDateTime, formatMoney } from "@/lib/format";
import type { TFunction } from "@/lib/i18n";
import { deliveryNs } from "@/messages/delivery";
import { SHIPMENT_STATUS_KEY, SHIPMENT_TONE, type ShipmentItem } from "./delivery-types";

type DT = TFunction<typeof deliveryNs.vi>;
export type ShipmentColumn = "waybill" | "code" | "createdAt" | "invoice" | "customerCode" | "customer" | "partner" | "status"
  | "deliveryTime" | "receiver" | "phone" | "address" | "area" | "cod" | "fee" | "completedAt" | "service";

/** Thứ tự cột như KiotViet (Mã vận đơn = mã vận đơn của đối tác, chưa có thì "---"). */
export const SHIPMENT_COLUMNS: ShipmentColumn[] = ["waybill", "createdAt", "invoice", "customerCode", "customer", "partner", "status",
  "deliveryTime", "receiver", "phone", "address", "area", "cod", "fee", "completedAt", "service", "code"];
export const DEFAULT_SHIPMENT_COLUMNS: ShipmentColumn[] = ["waybill", "createdAt", "invoice", "customerCode", "customer", "partner",
  "status", "deliveryTime", "receiver", "phone", "cod", "fee", "completedAt"];
export const MONEY_COLUMNS = new Set<ShipmentColumn>(["cod", "fee"]);

export const columnLabel = (t: DT, c: ShipmentColumn) => t(`kv.cols.${c}`);

/** Giá trị xuất file (chữ / số). */
export function cellValue(t: DT, s: ShipmentItem, c: ShipmentColumn): string | number | null {
  switch (c) {
    case "waybill": return s.waybillCode || "---";
    case "code": return s.code;
    case "createdAt": return formatDateTime(s.createdAt);
    case "invoice": return s.invoiceCode;
    case "customerCode": return s.customerCode ?? "";
    case "customer": return s.customerName;
    case "partner": return s.partnerName;
    case "status": return t(SHIPMENT_STATUS_KEY[s.status]);
    case "deliveryTime": return s.expectedDeliveryAt ? formatDateTime(s.expectedDeliveryAt) : "";
    case "receiver": return s.receiverName;
    case "phone": return s.receiverPhone;
    case "address": return s.receiverAddress;
    case "area": return s.area ?? "";
    case "cod": return Number(s.codAmount);
    case "fee": return Number(s.shippingFee);
    case "completedAt": return s.deliveredAt ? formatDateTime(s.deliveredAt) : "";
    case "service": return s.serviceType ? t(`selfShip.serviceTypes.${s.serviceType}`) : "";
  }
}

/** Ô trên bảng: mã là link xanh, trạng thái là badge màu, tiền canh phải. */
export function renderCell(t: DT, s: ShipmentItem, c: ShipmentColumn) {
  switch (c) {
    case "invoice": return <DocCodeLink code={s.invoiceCode} kind="/invoices" />;
    case "customerCode": return s.customerCode ? <DocCodeLink code={s.customerCode} kind="/customers" /> : null;
    case "code": return <DocCodeLink code={s.code} kind="/delivery/shipments" />;
    case "status": return <StatusBadge tone={SHIPMENT_TONE[s.status]}>{t(SHIPMENT_STATUS_KEY[s.status])}</StatusBadge>;
    case "cod": return formatMoney(s.codAmount);
    case "fee": return formatMoney(s.shippingFee);
    default: return cellValue(t, s, c);
  }
}
