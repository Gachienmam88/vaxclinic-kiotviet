/** Kiểu dữ liệu Giao hàng (sales-service: /delivery-partners, /shipments, /sales-channels). */

export type SalesChannel = { code: string; name: string; active: boolean; builtin: boolean; sortOrder: number };

export type DeliveryPartner = {
  id: string; code: string; name: string; phone: string | null; email: string | null; address: string | null; note: string | null;
  partnerType: string; active: boolean; shipmentCount: number; totalFee: number; totalCod: number; debt: number; createdAt: string;
  province?: string | null; ward?: string | null; provinceCode?: string | null; wardCode?: string | null;
  /** PERSONAL = Cá nhân, COMPANY = Công ty. */
  partnerKind?: "PERSONAL" | "COMPANY"; groupId?: string | null; groupName?: string | null;
  /** shipmentTotal: gồm cả đã hủy; codOpen: thu hộ đã ghi chưa đối soát; feeOpen: phí đã ghi chưa đối soát. */
  shipmentTotal?: number; codOpen?: number; feeOpen?: number;
};
/** Nhóm đối tác giao hàng (/delivery-partners/groups). */
export type PartnerGroup = { id: string; name: string; partnerCount: number };
/** Tỷ lệ giao thành công theo SĐT người nhận (rate null = chưa có vận đơn kết thúc). */
export type ReceiverStats = { finished: number; delivered: number; rate: number | null };
/** Loại dịch vụ tự giao. */
export type ServiceType = "STANDARD" | "EXPRESS" | "SAME_DAY";
export const SERVICE_TYPES: ServiceType[] = ["STANDARD", "EXPRESS", "SAME_DAY"];
/** Trạng thái chọn được khi tạo đơn ở màn bán hàng. */
export const INITIAL_SHIPMENT_STATUSES = ["PENDING", "PICKING", "DELIVERING", "DELIVERED"] as const;
export type PartnerList = { items: DeliveryPartner[]; total: number; page: number; size: number; sumFee: number; sumCod: number; sumDebt: number;
  sumShipments?: number; sumCodOpen?: number; sumFeeOpen?: number };

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

export type ShipmentStatus = "PENDING" | "PICKING" | "PICKED" | "WAIT_REPICK" | "DELIVERING" | "WAIT_REDELIVER" | "DELIVERED"
  | "WAIT_RETURN" | "RETURNING" | "WAIT_RERETURN" | "RETURNED" | "CANCELLED";

export type ShipmentItem = {
  id: string; code: string; createdAt: string; invoiceId: string; invoiceCode: string; customerName: string;
  receiverName: string; receiverPhone: string; receiverAddress: string; area: string | null; partnerId: string; partnerName: string;
  shippingFee: number; feePayer: "SHOP" | "CUSTOMER"; codAmount: number; status: ShipmentStatus; reconciled: boolean; branchId: string;
  provinceCode?: string | null; wardCode?: string | null;
  customerId?: string | null; customerCode?: string | null; waybillCode?: string | null; expectedDeliveryAt?: string | null;
  deliveredAt?: string | null; serviceType?: ServiceType | null;
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
  /** Tổng SL hàng của hóa đơn, ghi chú hóa đơn, kiện hàng; codOpen / partnerFee / partnerFeeOpen: số liệu "Thông tin vận chuyển". */
  itemQuantity: number; invoiceNote: string | null; packageCount: number; lengthCm: number | null; widthCm: number | null;
  heightCm: number | null; codOpen: number; partnerFee: number; partnerFeeOpen: number;
};
export type StatusStat = { status: ShipmentStatus; count: number; cod: number; fee: number };
export type ShipmentDashboard = {
  waitRedeliver: number; waitReturn: number; overdue: number; total: number; totalCod: number; totalFee: number; byStatus: StatusStat[];
};
export type CashflowRow = { partnerId: string; partnerCode: string; partnerName: string; codCollected: number; feeCharged: number;
  settled: number; balance: number };
export type Cashflow = { rows: CashflowRow[]; codCollected: number; feeCharged: number; settled: number; balance: number };
export type SettlementListRow = {
  id: string; code: string; kind: "RECONCILE" | "RECEIPT" | "PAYMENT"; partnerId: string; partnerCode: string; partnerName: string;
  codTotal: number; feeTotal: number; amount: number; shipmentCount: number; voucherCode: string | null; status: string;
  createdByName: string; createdAt: string;
};
/** Tóm tắt vận đơn trên chi tiết hóa đơn (InvoiceResponse.shipment). */
export type ShipmentInfo = {
  id: string; code: string; status: ShipmentStatus; partnerId: string; partnerName: string; receiverName: string; receiverPhone: string;
  receiverAddress: string; area: string | null; weightGram: number | null; shippingFee: number; feePayer: "SHOP" | "CUSTOMER";
  codAmount: number; note: string | null; deliveredAt: string | null; returnCode: string | null;
  provinceCode?: string | null; wardCode?: string | null;
  serviceType?: ServiceType; waybillCode?: string | null; expectedDeliveryAt?: string | null; packageCount?: number;
  lengthCm?: number | null; widthCm?: number | null; heightCm?: number | null; codEnabled?: boolean; createdAt?: string;
};
export type StatusResult = { id: string; code: string | null; ok: boolean; status: string | null; message: string | null };

export const SHIPMENT_STATUSES: [ShipmentStatus, string][] = [
  ["PENDING", "Chờ xử lý"], ["PICKING", "Đang lấy hàng"], ["PICKED", "Đã lấy hàng"], ["WAIT_REPICK", "Chờ lấy lại"],
  ["DELIVERING", "Đang giao hàng"], ["WAIT_REDELIVER", "Chờ giao lại"], ["DELIVERED", "Giao thành công"],
  ["WAIT_RETURN", "Chờ chuyển hoàn"], ["RETURNING", "Đang chuyển hoàn"], ["WAIT_RERETURN", "Chờ chuyển hoàn lại"],
  ["RETURNED", "Đã chuyển hoàn"], ["CANCELLED", "Đã hủy"],
];
export const shipmentStatusLabel = (s: string) => SHIPMENT_STATUSES.find(([k]) => k === s)?.[1] ?? s;
export const SHIPMENT_TONE: Record<ShipmentStatus, "green" | "red" | "gray" | "blue"> = {
  PENDING: "gray", PICKING: "blue", PICKED: "blue", WAIT_REPICK: "gray", DELIVERING: "blue", WAIT_REDELIVER: "red", DELIVERED: "green",
  WAIT_RETURN: "red", RETURNING: "red", WAIT_RERETURN: "red", RETURNED: "red", CANCELLED: "red",
};
/** Màu chấm / biểu đồ theo trạng thái (Quản lý giao hàng, như KiotViet). */
export const SHIPMENT_COLOR: Record<ShipmentStatus, string> = {
  PENDING: "#1a73e8", PICKING: "#34a853", PICKED: "#f29d38", WAIT_REPICK: "#ea4335", DELIVERING: "#e94bbf", WAIT_REDELIVER: "#4fd1c5",
  DELIVERED: "#a978e8", WAIT_RETURN: "#0b4a8b", RETURNING: "#0f8a3c", WAIT_RERETURN: "#c26a0a", RETURNED: "#b3000c", CANCELLED: "#9ca3af",
};
/** Bước chuyển hợp lệ (giống ShipmentStatus.java) → chỉ hiện nút đổi trạng thái dùng được. */
export const NEXT_STATUSES: Record<ShipmentStatus, ShipmentStatus[]> = {
  PENDING: ["PICKING", "PICKED", "DELIVERING", "DELIVERED", "CANCELLED"],
  PICKING: ["PICKED", "WAIT_REPICK", "DELIVERING", "DELIVERED", "CANCELLED"],
  WAIT_REPICK: ["PICKING", "PICKED", "CANCELLED"], PICKED: ["DELIVERING", "DELIVERED"],
  DELIVERING: ["DELIVERED", "WAIT_REDELIVER", "WAIT_RETURN", "RETURNING", "RETURNED"],
  WAIT_REDELIVER: ["DELIVERING", "DELIVERED", "WAIT_RETURN", "RETURNING", "RETURNED"],
  WAIT_RETURN: ["DELIVERING", "RETURNING", "RETURNED"], RETURNING: ["WAIT_RERETURN", "RETURNED"],
  WAIT_RERETURN: ["RETURNING", "RETURNED"], DELIVERED: [], RETURNED: [], CANCELLED: [],
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
  PENDING: "status.PENDING", PICKING: "status.PICKING", PICKED: "status.PICKED", WAIT_REPICK: "status.WAIT_REPICK",
  DELIVERING: "status.DELIVERING", WAIT_REDELIVER: "status.WAIT_REDELIVER", DELIVERED: "status.DELIVERED",
  WAIT_RETURN: "status.WAIT_RETURN", RETURNING: "status.RETURNING", WAIT_RERETURN: "status.WAIT_RERETURN",
  RETURNED: "status.RETURNED", CANCELLED: "status.CANCELLED",
} as const satisfies Record<ShipmentStatus, string>;
export const FEE_PAYER_KEY = { SHOP: "feePayer.SHOP", CUSTOMER: "feePayer.CUSTOMER" } as const;
export const LEDGER_KEY = {
  COD: "ledger.COD", FEE: "ledger.FEE", SETTLEMENT: "ledger.SETTLEMENT", SETTLEMENT_CANCEL: "ledger.SETTLEMENT_CANCEL",
} as const satisfies Record<PartnerLedgerRow["docType"], string>;
