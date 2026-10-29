"use client";

import { DocCodeLink } from "@/components/ui/doc-code-link";
import { SHIPMENT_STATUS_KEY, SHIPMENT_TONE, type ShipmentStatus } from "@/features/delivery/delivery-types";
import { StatusBadge } from "@/features/sales/invoice-list-kit";
import { formatDateTime, formatMoney } from "@/lib/format";
import type { TFunction } from "@/lib/i18n";
import { deliveryNs } from "@/messages/delivery";
import { salesNs } from "@/messages/sales";

/** Dòng danh sách Trả hàng (GET /sales-returns). type: INVOICE / QUICK / SHIPMENT (chuyển hoàn). */
export type ReturnRow = {
  id: string; code: string; returnedAt: string; invoiceCode: string | null; customerName: string | null; subtotal: number; fee: number;
  total: number; refunded: number; status: "COMPLETED" | "CANCELLED"; type: "INVOICE" | "QUICK" | "SHIPMENT"; invoiceId: string | null;
  customerCode: string | null; branchId: string; sellerName: string | null; createdAt: string; createdByName: string;
  salesChannelName: string | null; note: string | null; discount: number; saleShipmentCode: string | null;
  saleShipmentStatus: ShipmentStatus | null; partnerName: string | null;
};

type ST = TFunction<typeof salesNs.vi>;
type DT = TFunction<typeof deliveryNs.vi>;
export type ReturnColumn = "invoiceCode" | "saleShipmentCode" | "seller" | "returnedAt" | "createdAt" | "customerCode" | "customer"
  | "branch" | "createdBy" | "channel" | "note" | "subtotal" | "discount" | "afterDiscount" | "fee" | "total" | "refunded" | "status"
  | "deliveryStatus";

/**
 * Cột chọn được (Mã trả hàng luôn hiện), thứ tự như KiotViet. Bỏ các cột chưa có dữ liệu: Trạng thái / Ghi chú CSDL về dược,
 * Mã vận đơn trả, Người nhận trả, Tổng tiền hàng sau thuế, VAT hoàn lại, Giảm thuế hoàn lại, Thu khác hoàn lại, Trạng thái HĐĐT, Mã số HĐĐT.
 */
export const RETURN_COLUMNS: ReturnColumn[] = ["invoiceCode", "saleShipmentCode", "seller", "returnedAt", "createdAt", "customerCode",
  "customer", "branch", "createdBy", "channel", "note", "subtotal", "discount", "afterDiscount", "fee", "total", "refunded", "status",
  "deliveryStatus"];
export const DEFAULT_RETURN_COLUMNS: ReturnColumn[] = ["seller", "returnedAt", "customerCode", "customer", "subtotal", "total", "refunded",
  "status", "deliveryStatus"];
export const RETURN_MONEY = new Set<ReturnColumn>(["subtotal", "discount", "afterDiscount", "fee", "total", "refunded"]);

export function returnValue(t: ST, td: DT, r: ReturnRow, c: ReturnColumn | "code", branch: (id: string) => string): string | number {
  switch (c) {
    case "code": return r.code;
    case "invoiceCode": return r.invoiceCode ?? "";
    case "saleShipmentCode": return r.saleShipmentCode ?? "";
    case "seller": return r.sellerName ?? "";
    case "returnedAt": return formatDateTime(r.returnedAt);
    case "createdAt": return formatDateTime(r.createdAt);
    case "customerCode": return r.customerCode ?? "";
    case "customer": return r.customerName ?? "";
    case "branch": return branch(r.branchId);
    case "createdBy": return r.createdByName;
    case "channel": return r.salesChannelName ?? "";
    case "note": return r.note ?? "";
    case "subtotal": return Number(r.subtotal);
    case "discount": return Number(r.discount);
    case "afterDiscount": return Number(r.subtotal) - Number(r.discount);
    case "fee": return Number(r.fee);
    case "total": return Number(r.total);
    case "refunded": return Number(r.refunded);
    case "status": return t(`returns.kv.statuses.${r.status}`);
    case "deliveryStatus": return r.saleShipmentStatus ? td(SHIPMENT_STATUS_KEY[r.saleShipmentStatus]) : "";
  }
}

export function returnCell(t: ST, td: DT, r: ReturnRow, c: ReturnColumn, branch: (id: string) => string) {
  switch (c) {
    case "invoiceCode": return r.invoiceCode ? <DocCodeLink code={r.invoiceCode} kind="/invoices" /> : "";
    case "saleShipmentCode": return r.saleShipmentCode ? <DocCodeLink code={r.saleShipmentCode} kind="/delivery/shipments" /> : "";
    case "customerCode": return r.customerCode ? <DocCodeLink code={r.customerCode} kind="/customers" /> : "";
    case "status": return <StatusBadge tone={r.status === "COMPLETED" ? "green" : "red"}>{t(`returns.kv.statuses.${r.status}`)}</StatusBadge>;
    case "deliveryStatus": return r.saleShipmentStatus
      ? <StatusBadge tone={SHIPMENT_TONE[r.saleShipmentStatus]}>{td(SHIPMENT_STATUS_KEY[r.saleShipmentStatus])}</StatusBadge> : "";
    default: {
      const v = returnValue(t, td, r, c, branch);
      return RETURN_MONEY.has(c) ? formatMoney(Number(v)) : v;
    }
  }
}
