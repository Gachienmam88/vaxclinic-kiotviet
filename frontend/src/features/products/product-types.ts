/** Kiểu dữ liệu khớp với ProductDtos của product-service. Số BigDecimal về dạng number. */

export type Category = { id: string; name: string; parentId: string | null };
export type TaxRate = { id: string; code: string; name: string; vatRate: number | null };
export type Position = { id: string; name: string };

export type StockFilter = "ALL" | "BELOW_MIN" | "ABOVE_MAX" | "IN_STOCK" | "OUT_OF_STOCK";

export type ProductListItem = {
  id: string;
  code: string;
  name: string;
  shortName: string | null;
  unitName: string;
  otherUnits: string[];
  price: number;
  cost: number;
  taxRateName: string | null;
  taxReduction: boolean;
  lotManaged: boolean;
  stock: number;
  reserved: number;
  active: boolean;
};

export type ProductListResponse = {
  items: ProductListItem[];
  total: number;
  page: number;
  size: number;
  totalStock: number;
};

export type ProductUnit = {
  id: string;
  code: string;
  barcode: string | null;
  unitName: string;
  conversionRate: number;
  price: number;
  base: boolean;
  directSale: boolean;
};

export type ProductDetail = {
  id: string;
  name: string;
  shortName: string | null;
  einvoiceName: string | null;
  categoryId: string;
  categoryName: string | null;
  taxRateId: string | null;
  taxRateName: string | null;
  taxReduction: boolean;
  lotManaged: boolean;
  cost: number;
  minStock: number;
  maxStock: number;
  positionId: string | null;
  positionName: string | null;
  weight: number | null;
  weightUnit: string;
  description: string | null;
  note: string | null;
  loyaltyPoints: boolean;
  active: boolean;
  createdAt: string;
  units: ProductUnit[];
  stocks: { branchId: string; quantity: number; reserved: number }[];
};

export type LedgerLine = {
  id: string;
  docType: string;
  docCode: string | null;
  occurredAt: string;
  branchId: string;
  lotNumber: string | null;
  unitPrice: number;
  cost: number;
  quantity: number;
  balanceAfter: number;
  partnerName: string | null;
};

export type ProductLot = { id: string; branchId: string; lotNumber: string; expiryDate: string; quantity: number };

/** Tên hiển thị loại giao dịch trên thẻ kho. */
export const DOC_TYPE_LABEL: Record<string, string> = {
  OPENING: "Khởi tạo tồn",
  PURCHASE: "Nhập hàng",
  PURCHASE_RETURN: "Trả hàng nhập",
  SALE: "Bán hàng",
  SALE_RETURN: "Khách trả hàng",
  ADJUSTMENT: "Kiểm kho",
  TRANSFER_OUT: "Chuyển hàng đi",
  TRANSFER_IN: "Nhận hàng chuyển",
  DAMAGE: "Xuất hủy",
};
