import { api } from "@/lib/api-client";
import type { Order } from "@/features/orders/order-types";
import type { SaleT } from "@/messages/sale";
import { cachedCustomerGroupId, toCartLines } from "./sale-open-invoice";
import { newId } from "./sale-storage";
import type { CatalogProduct, DraftInvoice } from "./sale-types";

/**
 * Mở đơn đặt hàng lên màn bán hàng (cần mạng):
 * - "edit" (/sale?order=<id>): tab đặt hàng với giỏ hàng của đơn; "Khách thanh toán" = tiền cọc trả thêm → nút LƯU ĐƠN.
 * - "invoice" (/sale?orderInvoice=<id>): tab hóa đơn mới gắn đơn; tiền cọc trừ vào khách cần trả → THANH TOÁN tạo hóa đơn.
 */
export async function draftFromOrder(orderId: string, mode: "edit" | "invoice", catalog: CatalogProduct[],
                                     sellerId: string, t: SaleT): Promise<DraftInvoice> {
  const o = await api<Order>(`/orders/${orderId}`);
  if (o.status === "COMPLETED") throw new Error(t("open.orderInvoiced", { code: o.code, invoice: o.invoiceCode ?? "" }).trim());
  if (o.status === "CANCELLED") throw new Error(t("open.orderCancelled", { code: o.code }));
  const ref = { orderId: o.id, code: o.code, deposit: Number(o.deposit) };
  const base = {
    mode: "QUICK" as const, customer: { id: o.customerId, code: o.customerCode ?? "", name: o.customerName, phone: o.customerPhone,
      groupId: cachedCustomerGroupId(o.customerId) },
    sellerId: o.sellerId ?? sellerId, discount: Number(o.discount), discountPercent: null, paid: null,
    paymentMethod: "CASH" as const, note: o.note ?? "", lines: toCartLines(o.lines, catalog), priceBookId: o.priceBookId ?? null,
    priceBookName: o.priceBookName, salesChannel: o.salesChannel ?? "DIRECT", expectedDeliveryAt: localInput(o.expectedDeliveryAt),
  };
  return mode === "edit"
    ? { ...base, id: o.id, kind: "ORDER", orderOf: ref, label: o.code }
    : { ...base, id: newId(), kind: "SALE", fromOrder: ref, label: t("open.invoiceFromOrderLabel", { code: o.code }) };
}

/** ISO → giá trị ô datetime-local (giờ máy). */
function localInput(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
