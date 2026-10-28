/** Kiểu dữ liệu Đặt hàng — khớp OrderDtos của sales-service. */

export type OrderStatus = "DRAFT" | "CONFIRMED" | "COMPLETED" | "CANCELLED";

export const ORDER_STATUS_OPTIONS = [
  ["DRAFT", "Phiếu tạm"], ["CONFIRMED", "Đã xác nhận"], ["COMPLETED", "Hoàn thành"], ["CANCELLED", "Đã hủy"],
] as const;

export const orderStatusLabel = (s: OrderStatus) => ORDER_STATUS_OPTIONS.find(([v]) => v === s)?.[1] ?? s;

/** Màu badge trạng thái: tạm xám, xác nhận xanh dương, hoàn thành xanh lá, hủy đỏ. */
export const ORDER_STATUS_TONE = { DRAFT: "gray", CONFIRMED: "blue", COMPLETED: "green", CANCELLED: "red" } as const;

export type OrderLine = {
  id: string; lineNo: number; productId: string; unitId: string; productCode: string; productName: string;
  unitName: string; quantity: number; unitPrice: number; discount: number; price: number; amount: number;
  note: string | null; taxCode: string | null;
};

/** Phiếu thu đặt cọc (RECEIPT) / phiếu chi hoàn cọc khi hủy đơn (PAYMENT). */
export type OrderPayment = {
  voucherId: string; code: string; voucherType: "RECEIPT" | "PAYMENT"; occurredAt: string; createdByName: string;
  amount: number; fund: string; status: "PAID" | "CANCELLED";
};

export type Order = {
  id: string; code: string; branchId: string; customerId: string; customerCode: string | null; customerName: string;
  customerPhone: string | null; sellerId: string | null; sellerName: string | null; createdByName: string; orderedAt: string;
  status: OrderStatus; subtotal: number; discount: number; total: number; deposit: number; note: string | null;
  invoiceId: string | null; invoiceCode: string | null; cancelledAt: string | null; lines: OrderLine[]; payments: OrderPayment[];
  priceBookId: string | null; priceBookName: string | null; salesChannel: string; expectedDeliveryAt: string | null;
};

export type OrderListItem = {
  id: string; code: string; orderedAt: string; customerCode: string | null; customerName: string; createdByName: string;
  subtotal: number; discount: number; total: number; deposit: number; status: OrderStatus; invoiceCode: string | null;
  expectedDeliveryAt: string | null; salesChannel: string;
};

export type OrderList = {
  items: OrderListItem[]; total: number; page: number; size: number; sumSubtotal: number; sumTotal: number; sumDeposit: number;
};
