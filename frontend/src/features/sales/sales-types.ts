/** Kiểu dữ liệu khớp DTO của sales-service (khách hàng, hóa đơn, sổ quỹ, công nợ). */

export type Customer = {
  id: string; code: string; name: string; phone: string | null; phone2: string | null; email: string | null;
  facebook: string | null; birthday: string | null; gender: "MALE" | "FEMALE" | null; address: string | null;
  province: string | null; ward: string | null; groupId: string | null; groupName: string | null; note: string | null;
  customerType: "PERSONAL" | "COMPANY"; buyerName: string | null; companyName: string | null; taxCode: string | null;
  invoiceAddress: string | null; invoiceProvince: string | null; invoiceWard: string | null; idNumber: string | null;
  passport: string | null; invoiceEmail: string | null; invoicePhone: string | null; bankName: string | null;
  bankAccount: string | null; debt: number; totalSales: number; totalReturns: number; branchId: string | null;
  createdByName: string | null; createdAt: string; active: boolean;
  /** Mã ĐVHC 2 cấp; null với khách cũ chỉ có tên khu vực. */
  provinceCode?: string | null; wardCode?: string | null; invoiceProvinceCode?: string | null; invoiceWardCode?: string | null;
};

export type CustomerListItem = {
  id: string; code: string; name: string; phone: string | null; groupId: string | null; groupName: string | null;
  groupDiscountType: GroupDiscountType | null; groupDiscountValue: number | null;
  debt: number; totalSales: number; netSales: number;
};

export type GroupDiscountType = "PERCENT" | "AMOUNT";

/** Nhóm khách hàng (/customer-groups): giảm giá nhóm tự điền vào giảm giá hóa đơn ở màn bán hàng. */
export type CustomerGroup = {
  id: string; name: string; discountType: GroupDiscountType; discountValue: number; note: string | null;
  customerCount: number; createdAt: string;
};

export type CustomerList = {
  items: CustomerListItem[]; total: number; page: number; size: number;
  sumDebt: number; sumSales: number; sumNetSales: number;
};

export type DebtLine = {
  id: string; docType: string; docCode: string; docId: string | null; occurredAt: string;
  amount: number; balanceAfter: number; note: string | null;
};

export const DEBT_TYPE_LABEL: Record<string, string> = {
  SALE: "Bán hàng", SALE_CANCEL: "Hủy hóa đơn", PAYMENT: "Thanh toán", PAYMENT_CANCEL: "Hủy phiếu thu",
  ADJUST: "Điều chỉnh", DISCOUNT: "Chiết khấu thanh toán",
};

export type InvoiceLine = {
  id: string; lineNo: number; productId: string; unitId: string; productCode: string; productName: string;
  unitName: string; quantity: number; unitPrice: number; discount: number; price: number; amount: number;
  cost: number; lots: string | null; note: string | null; taxCode: string | null; returnedQuantity: number;
};

export type InvoicePayment = {
  voucherId: string; code: string; occurredAt: string; createdByName: string; voucherAmount: number;
  fund: string; status: string; allocated: number;
};

export type Invoice = {
  id: string; code: string; branchId: string; customerId: string | null; customerCode: string | null;
  customerName: string; customerPhone: string | null; sellerId: string | null; sellerName: string | null;
  createdByName: string; soldAt: string; status: "COMPLETED" | "CANCELLED"; saleMode: string; subtotal: number;
  discount: number; total: number; paid: number; paymentMethod: string | null; note: string | null; offline: boolean;
  revision: number; lines: InvoiceLine[]; payments: InvoicePayment[]; orderId: string | null; orderCode: string | null;
  /** Bảng giá áp dụng (null = Bảng giá chung), kênh bán, vận đơn (Bán giao hàng). */
  priceBookId: string | null; priceBookName: string | null; salesChannel: string; salesChannelName: string;
  shipment: import("@/features/delivery/delivery-types").ShipmentInfo | null;
  /** Địa chỉ khách ghép "địa chỉ, Phường/Xã, Tỉnh/Thành phố" (null: khách lẻ / chưa có địa chỉ). */
  customerAddress?: string | null;
};

export type InvoiceListItem = {
  id: string; code: string; soldAt: string; customerCode: string | null; customerName: string;
  sellerName: string | null; subtotal: number; discount: number; total: number; paid: number;
  status: "COMPLETED" | "CANCELLED"; paymentMethod: string | null;
  /** Trạng thái hiển thị kiểu KiotViet (theo vận đơn), loại bán, mã phiếu trả hàng ("TH0001, TH0002"). */
  state: InvoiceState; saleMode: string; returnCodes: string | null;
};

export type InvoiceState = "PROCESSING" | "COMPLETED" | "FAILED_DELIVERY" | "CANCELLED";

export type InvoiceList = {
  items: InvoiceListItem[]; total: number; page: number; size: number;
  sumSubtotal: number; sumDiscount: number; sumTotal: number; sumPaid: number;
};

export type CashItem = {
  id: string; code: string; occurredAt: string; voucherType: "RECEIPT" | "PAYMENT"; category: string; fund: string;
  partnerName: string | null; partnerPhone: string | null; amount: number; status: "PAID" | "CANCELLED";
  accounting: boolean; sourceType: string;
};

export type CashPage = {
  items: CashItem[]; total: number; page: number; size: number;
  summary: { opening: number; receipts: number; payments: number; closing: number };
};

export type BankAccount = {
  id: string; bankName: string; bankBin: string | null; accountNo: string; accountName: string;
  kind?: "BANK" | "EWALLET"; note?: string | null;
};

/** Nhãn tiếng Việt dùng cho bản in / CSV kế toán. Giao diện: salesNs "enums.paymentMethod.<value>" (enumLabel). */
export const PAYMENT_METHODS = [
  { value: "CASH", label: "Tiền mặt" }, { value: "TRANSFER", label: "Chuyển khoản" },
  { value: "CARD", label: "Thẻ" }, { value: "EWALLET", label: "Ví điện tử" },
] as const;

export const methodLabel = (m: string | null) => PAYMENT_METHODS.find((x) => x.value === m)?.label ?? "";

/** Nhãn tiếng Việt cho bản in. Giao diện: salesNs "enums.fund.<value>". */
export const FUND_LABEL: Record<string, string> = { CASH: "Tiền mặt", BANK: "Ngân hàng", EWALLET: "Ví điện tử", ALL: "Tổng quỹ" };
