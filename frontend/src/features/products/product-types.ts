/** Kiểu dữ liệu khớp với ProductDtos của product-service. Số BigDecimal về dạng number. */

/** productCount: số hàng hóa trực tiếp trong nhóm. */
export type Category = { id: string; name: string; parentId: string | null; productCount: number };
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
  createdAt: string;
  /** Số ngày còn bán được theo tốc độ bán 30 ngày gần nhất; null = chưa bán trong khoảng đó. */
  expectedOutDays: number | null;
  /** Mọi đơn vị tính (cơ bản trước) cho ô chọn đơn vị trên dòng. */
  units: ListUnit[];
};

/** Đơn vị tính trên dòng danh sách; giá vốn / tồn của đơn vị = giá trị cơ bản × / ÷ conversionRate. */
export type ListUnit = { code: string; unitName: string; conversionRate: number; price: number };

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
  /** expectedOutDays: dự kiến hết hàng ở chi nhánh (null = chưa bán ròng trong 30 ngày). */
  stocks: { branchId: string; quantity: number; reserved: number; expectedOutDays: number | null }[];
  /** NCC đã nhập hàng này (phiếu nhập hoàn thành), nhập gần nhất trước. */
  suppliers: { id: string; code: string; name: string }[];
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
