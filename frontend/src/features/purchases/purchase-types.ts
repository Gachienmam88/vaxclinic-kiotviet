/** Kiểu dữ liệu khớp PurchaseDtos / SupplierController của product-service. */

export type DocStatus = "DRAFT" | "COMPLETED" | "CANCELLED";

export const RECEIPT_STATUS_LABEL: Record<DocStatus, string> = {
  DRAFT: "Phiếu tạm", COMPLETED: "Đã nhập hàng", CANCELLED: "Đã hủy",
};
export const RETURN_STATUS_LABEL: Record<DocStatus, string> = {
  DRAFT: "Phiếu tạm", COMPLETED: "Đã trả hàng", CANCELLED: "Đã hủy",
};

export type Supplier = {
  id: string; code: string; name: string; phone: string | null; email: string | null; address: string | null;
  province: string | null; ward: string | null; groupName: string | null; note: string | null;
  companyName: string | null; taxCode: string | null; idNumber: string | null; active: boolean;
};

export type ListTotals = { subtotal: number; discount: number; vatAmount: number; total: number; paidAmount: number };

export type ReceiptListItem = {
  id: string; code: string; status: DocStatus; receivedAt: string; supplierCode: string | null;
  supplierName: string | null; inputInvoiceNo: string | null; createdByName: string; receiverName: string | null;
  subtotal: number; discount: number; vatAmount: number; total: number; paidAmount: number;
};

export type ReceiptLine = {
  id: string; lineNo: number; productId: string; productCode: string; productName: string; unitId: string;
  unitName: string; conversionRate: number; quantity: number; unitPrice: number; discount: number;
  priceWithVat: number; amount: number; lotNumber: string | null; expiryDate: string | null;
};

export type Receipt = {
  id: string; code: string; branchId: string; status: DocStatus; receivedAt: string; supplierId: string | null;
  supplierCode: string | null; supplierName: string | null; createdBy: string; createdByName: string;
  receiverId: string | null; receiverName: string | null; inputInvoiceNo: string | null; vatRate: number | null;
  subtotal: number; discount: number; vatAmount: number; total: number; paidAmount: number;
  paymentMethod: string | null; note: string | null; lines: ReceiptLine[];
};

export type ReturnListItem = {
  id: string; code: string; status: DocStatus; returnedAt: string; supplierName: string | null;
  receiptCode: string | null; returnerName: string | null; subtotal: number; discount: number;
  vatAmount: number; total: number; refundAmount: number;
};

export type PurchaseReturn = {
  id: string; code: string; branchId: string; status: DocStatus; returnedAt: string; supplierId: string | null;
  supplierCode: string | null; supplierName: string | null; receiptId: string | null; receiptCode: string | null;
  createdByName: string; returnerId: string | null; returnerName: string | null; subtotal: number; discount: number;
  vatRate: number | null; vatAmount: number; total: number; refundAmount: number; note: string | null;
  lines: {
    id: string; lineNo: number; productId: string; productCode: string; productName: string; unitId: string;
    unitName: string; conversionRate: number; quantity: number; unitPrice: number; amount: number; lotNumber: string | null;
  }[];
};

export type ListResponse<T> = { items: T[]; total: number; page: number; size: number; sums: ListTotals };

export type UserLookup = { id: string; fullName: string };
