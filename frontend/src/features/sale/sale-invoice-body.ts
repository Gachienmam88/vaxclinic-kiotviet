import { cartTotals } from "./use-sale-tabs";
import { splitPayments } from "./sale-payment-split";
import type { DeliveryDraft, DraftInvoice } from "./sale-types";



/**
 * Body gửi POST /invoices (bán mới / offline queue / tạo hóa đơn từ đơn đặt hàng — kèm orderId) và PUT /invoices/{id}.
 * Cũng dùng cho POST/PUT /orders (đặt hàng): paidAmount = tiền khách trả thêm lần này (đặt cọc), kèm thời gian giao hàng.
 * Bán giao hàng: delivery → vận đơn (thu hộ server tính = khách cần trả − đã trả). Hàng đợi offline giữ nguyên body này.
 */
export function toBody(d: DraftInvoice, branchId: string, sellerName: string | undefined, offline: boolean) {
  const t = cartTotals(d);
  const pay = d.kind === "ORDER" || d.editOf ? { primary: Math.min(t.paid, t.due), extras: [] } : splitPayments(d, t.paid, t.due);
  return {
    id: d.id, branchId, customerId: d.customer?.id ?? null, sellerId: d.sellerId || null, sellerName,
    soldAt: new Date().toISOString(), saleMode: d.mode, discount: t.discount, paidAmount: pay.primary, extraPayments: pay.extras,
    einvoiceBuyer: d.kind !== "ORDER" && d.einvoiceBuyer ? d.einvoiceBuyer : null,
    paymentMethod: d.paymentMethod, note: d.note, offline, orderId: d.fromOrder?.orderId ?? null,
    priceBookId: d.priceBookId, priceBookName: d.priceBookId ? d.priceBookName ?? null : null, salesChannel: d.salesChannel || "DIRECT",
    delivery: d.mode === "DELIVERY" && d.kind !== "ORDER" && d.delivery ? deliveryBody(d.delivery) : null,
    expectedDeliveryAt: d.kind === "ORDER" && d.expectedDeliveryAt ? new Date(d.expectedDeliveryAt).toISOString() : null,
    lines: d.lines.map((l) => {
      const u = l.units.find((x) => x.id === l.unitId)!;
      return { productId: l.productId, unitId: l.unitId, productCode: u.code, productName: l.productName, unitName: u.unitName,
        quantity: l.quantity, unitPrice: l.unitPrice, discount: l.discount, note: l.note || null, taxCode: l.taxCode };
    }),
  };
}

const deliveryBody = (v: DeliveryDraft) => ({
  partnerId: v.partnerId, receiverName: v.receiverName.trim(), receiverPhone: v.receiverPhone.trim(),
  receiverAddress: v.receiverAddress.trim(), area: v.area.trim() || null, weightGram: v.weightGram, shippingFee: v.shippingFee,
  feePayer: v.feePayer, note: v.note.trim() || null, provinceCode: v.provinceCode || null, wardCode: v.wardCode || null,
});

/** Lỗi thiếu thông tin giao hàng (null = đủ) — kiểm tra trước khi thanh toán tab Bán giao hàng. */
export function deliveryProblem(d: DraftInvoice): string | null {
  if (d.mode !== "DELIVERY" || d.kind === "ORDER") return null;
  const v = d.delivery;
  if (!v?.partnerId) return "Chưa chọn đối tác giao hàng";
  if (!v.receiverName.trim() || !v.receiverPhone.trim() || !v.receiverAddress.trim()) return "Nhập đủ tên, SĐT, địa chỉ người nhận";
  return null;
}
