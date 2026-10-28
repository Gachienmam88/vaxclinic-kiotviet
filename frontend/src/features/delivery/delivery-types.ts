/** Kiểu dữ liệu Giao hàng (sales-service: /delivery-partners, /shipments, /sales-channels). */

export type SalesChannel = { code: string; name: string; active: boolean; builtin: boolean; sortOrder: number };

export type DeliveryPartner = {
  id: string; code: string; name: string; phone: string | null; email: string | null; address: string | null; note: string | null;
  partnerType: string; active: boolean; shipmentCount: number; totalFee: number; totalCod: number; debt: number; createdAt: string;
  province?: string | null; ward?: string | null; provinceCode?: string | null; wardCode?: string | null;
};
export type PartnerList = { items: DeliveryPartner[]; total: number; page: number; size: number; sumFee: number; sumCod: number; sumDebt: number };

export type PartnerLedgerRow = {
  id: string; docType: "COD" | "FEE" | "SETTLEMENT" | "SETTLEMENT_CANCEL"; docId: string | null; docCode: string | null;
  amount: number; balanceAfter: number; note: string | null; occurredAt: string;
};
export type SettlementRow = {
  id: string; code: string; kind: "RECONCILE" | "RECEIPT" | "PAYMENT"; branchId: string; codTotal: number; feeTotal: number;
  amount: number; shipmentCount: number; voucherCode: string | null; status: string; note: string | null; createdByName: string; createdAt: string;
};
export type ReconcileRow = {
  id: string; code: string; invoiceCode: string; receiverName: string; status: string; branchId: string;
  cod: number; fee: number; net: number; deliveredAt: string | null;
};
export type SettlementResult = { id: string; code: string; voucherCode: string | null; amount: number };

export type ShipmentStatus = "PENDING" | "PICKING" | "DELIVERING" | "DELIVERED" | "RETURNING" | "RETURNED" | "CANCELLED";

export type ShipmentItem = {
  id: string; code: string; createdAt: string; invoiceId: string; invoiceCode: string; customerName: string;
  receiverName: string; receiverPhone: string; receiverAddress: string; area: string | null; partnerId: string; partnerName: string;
  shippingFee: number; feePayer: "SHOP" | "CUSTOMER"; codAmount: number; status: ShipmentStatus; reconciled: boolean; branchId: string;
  provinceCode?: string | null; wardCode?: string | null;
};
export type ShipmentList = {
  items: ShipmentItem[]; total: number; page: number; size: number; sumFee: number; sumCod: number; statusCounts: Record<ShipmentStatus, number>;
};
export type StatusLog = { fromStatus: string | null; toStatus: ShipmentStatus; note: string | null; changedByName: string; changedAt: string };
export type ShipmentDetail = {
  item: ShipmentItem; weightGram: number | null; note: string | null; deliveredAt: string | null; returnId: string | null;
  returnCode: string | null; settlementCode: string | null; createdByName: string; invoiceTotal: number; invoicePaid: number;
  /** Phí đã ghi sổ đối tác (giao thành công / đã chuyển hoàn); returnFee = phần phí chuyển hoàn. */
  feePosted: number | null; returnFee: number; logs: StatusLog[];
};
/** Tóm tắt vận đơn trên chi tiết hóa đơn (InvoiceResponse.shipment). */
export type ShipmentInfo = {
  id: string; code: string; status: ShipmentStatus; partnerId: string; partnerName: string; receiverName: string; receiverPhone: string;
  receiverAddress: string; area: string | null; weightGram: number | null; shippingFee: number; feePayer: "SHOP" | "CUSTOMER";
  codAmount: number; note: string | null; deliveredAt: string | null; returnCode: string | null;
  provinceCode?: string | null; wardCode?: string | null;
};
export type StatusResult = { id: string; code: string | null; ok: boolean; status: string | null; message: string | null };

export const SHIPMENT_STATUSES: [ShipmentStatus, string][] = [
  ["PENDING", "Chờ xử lý"], ["PICKING", "Đang lấy hàng"], ["DELIVERING", "Đang giao hàng"], ["DELIVERED", "Giao thành công"],
  ["RETURNING", "Chuyển hoàn"], ["RETURNED", "Đã chuyển hoàn"], ["CANCELLED", "Đã hủy"],
];
export const shipmentStatusLabel = (s: string) => SHIPMENT_STATUSES.find(([k]) => k === s)?.[1] ?? s;
export const SHIPMENT_TONE: Record<ShipmentStatus, "green" | "red" | "gray" | "blue"> = {
  PENDING: "gray", PICKING: "blue", DELIVERING: "blue", DELIVERED: "green", RETURNING: "red", RETURNED: "red", CANCELLED: "red",
};
/** Bước chuyển hợp lệ (giống ShipmentStatus.java) → chỉ hiện nút đổi trạng thái dùng được. */
export const NEXT_STATUSES: Record<ShipmentStatus, ShipmentStatus[]> = {
  PENDING: ["PICKING", "DELIVERING", "DELIVERED", "CANCELLED"], PICKING: ["DELIVERING", "DELIVERED", "CANCELLED"],
  DELIVERING: ["DELIVERED", "RETURNING", "RETURNED"], RETURNING: ["RETURNED"], DELIVERED: [], RETURNED: [], CANCELLED: [],
};
export const FEE_PAYERS: ["SHOP" | "CUSTOMER", string][] = [["SHOP", "Cửa hàng trả"], ["CUSTOMER", "Người nhận trả"]];
export const LEDGER_LABELS: Record<PartnerLedgerRow["docType"], string> = {
  COD: "Thu hộ", FEE: "Phí giao hàng", SETTLEMENT: "Thanh toán / đối soát", SETTLEMENT_CANCEL: "Hủy thanh toán",
};

/**
 * Khóa i18n (namespace "delivery") cho màn hình: t(SHIPMENT_STATUS_KEY[s]), t(FEE_PAYER_KEY[p]), t(LEDGER_KEY[d]).
 * Các mảng / map tiếng Việt ở trên giữ lại cho nơi chưa i18n (VD features/sale) và in ấn.
 */
export const SHIPMENT_STATUS_KEY = {
  PENDING: "status.PENDING", PICKING: "status.PICKING", DELIVERING: "status.DELIVERING", DELIVERED: "status.DELIVERED",
  RETURNING: "status.RETURNING", RETURNED: "status.RETURNED", CANCELLED: "status.CANCELLED",
} as const satisfies Record<ShipmentStatus, string>;
export const FEE_PAYER_KEY = { SHOP: "feePayer.SHOP", CUSTOMER: "feePayer.CUSTOMER" } as const;
export const LEDGER_KEY = {
  COD: "ledger.COD", FEE: "ledger.FEE", SETTLEMENT: "ledger.SETTLEMENT", SETTLEMENT_CANCEL: "ledger.SETTLEMENT_CANCEL",
} as const satisfies Record<PartnerLedgerRow["docType"], string>;
