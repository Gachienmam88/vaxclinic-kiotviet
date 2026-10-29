/** Kiểu dữ liệu màn Nhà cung cấp — khớp SupplierListQuery / SupplierDebtDtos / SupplierGroupController (product-service). */

import type { Supplier } from "./purchase-types";

export type SupplierRow = Supplier & {
  branchId: string | null; createdByName: string | null; createdAt: string; debt: number; totalBuy: number;
};

export type SupplierPage = { items: SupplierRow[]; total: number; page: number; size: number; sumDebt: number; sumTotalBuy: number };

export type SupplierGroup = { id: string; name: string; note: string | null; supplierCount: number };

export type SupplierDebtType = "PURCHASE" | "PURCHASE_RETURN" | "PAYMENT" | "DISCOUNT" | "ADJUSTMENT" | "REFUND";

/** Nhãn loại giao dịch trên màn hình (khóa namespace "purchases"). */
export const SUPPLIER_DEBT_TYPE_KEY = {
  PURCHASE: "suppliers.debtType.purchase", PURCHASE_RETURN: "suppliers.debtType.purchaseReturn",
  PAYMENT: "suppliers.debtType.payment", ADJUSTMENT: "suppliers.debtType.adjustment", DISCOUNT: "suppliers.debtType.discount",
  REFUND: "suppliers.debtType.refund",
} as const satisfies Record<SupplierDebtType, string>;

/** Nhãn tiếng Việt cố định cho file CSV công nợ (sổ công nợ dùng đối chiếu kế toán → giữ tiếng Việt mọi ngôn ngữ). */
export const SUPPLIER_DEBT_TYPE_LABEL: Record<SupplierDebtType, string> = {
  PURCHASE: "Nhập hàng", PURCHASE_RETURN: "Trả hàng nhập", PAYMENT: "Thanh toán", ADJUSTMENT: "Điều chỉnh",
  DISCOUNT: "Chiết khấu thanh toán", REFUND: "NCC hoàn tiền",
};

export type SupplierLedgerRow = {
  docId: string; docType: SupplierDebtType; docCode: string; occurredAt: string; amount: number; balance: number;
};

export type SupplierHistoryRow = {
  id: string; kind: "RECEIPT" | "RETURN"; code: string; time: string; createdByName: string; total: number;
  status: "DRAFT" | "COMPLETED" | "CANCELLED";
};

export type UnpaidReceipt = { id: string; code: string; receivedAt: string; total: number; paidBefore: number; remaining: number };

export type SupplierDocAllocation = {
  receiptId: string; code: string; receivedAt: string; total: number; paidBefore: number; amount: number; fullyPaid: boolean;
};

export type SupplierDebtDoc = {
  id: string; code: string; kind: "PAYMENT" | "DISCOUNT" | "ADJUSTMENT" | "REFUND"; status: "ACTIVE" | "CANCELLED";
  supplierId: string; supplierCode: string; supplierName: string; branchId: string | null; occurredAt: string;
  amount: number; paymentMethod: string | null; bankAccountId: string | null; staffId: string | null;
  staffName: string | null; createdByName: string; note: string | null; receiptId: string | null;
  allocations: SupplierDocAllocation[]; unallocated: number;
};

/** [mã, khóa nhãn trong namespace "purchases"]. */
export const SUPPLIER_PAYMENT_METHODS = [
  ["CASH", "payMethods.cash"], ["TRANSFER", "payMethods.transfer"], ["EWALLET", "payMethods.ewallet"],
] as const;

/** Bộ lọc màn danh sách NCC (sidebar trái). Chuỗi rỗng = không lọc. */
export type SupplierFilters = {
  groupId: string; buyFrom: string; buyTo: string; buyPeriod: "all" | "custom"; from: string; to: string;
  debtFrom: string; debtTo: string; status: "" | "active" | "inactive";
};

export const DEFAULT_SUPPLIER_FILTERS: SupplierFilters = {
  groupId: "", buyFrom: "", buyTo: "", buyPeriod: "all", from: "", to: "", debtFrom: "", debtTo: "", status: "active",
};
