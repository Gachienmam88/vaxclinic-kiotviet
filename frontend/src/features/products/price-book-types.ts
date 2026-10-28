/** Kiểu dữ liệu Thiết lập giá (khớp PriceBookDtos ở product-service). */

/** Hàng không có trong bảng giá: ALLOW = dùng giá chung, BLOCK = chặn, WARN = cho phép kèm cảnh báo. */
export type MissingPolicy = "ALLOW" | "BLOCK" | "WARN";
export type FormulaOp = "PLUS" | "MINUS";
export type FormulaBase = "BASE_PRICE" | "COST" | "LAST_PURCHASE" | "BOOK";

export const MISSING_POLICY_LABEL: Record<MissingPolicy, string> = {
  ALLOW: "Cho phép (dùng giá chung)",
  BLOCK: "Không cho phép",
  WARN: "Cho phép kèm cảnh báo",
};

export const FORMULA_BASE_LABEL: Record<FormulaBase, string> = {
  BASE_PRICE: "Giá chung",
  COST: "Giá vốn",
  LAST_PURCHASE: "Giá nhập cuối",
  BOOK: "Bảng giá khác",
};

/** Phạm vi null = tất cả. */
export type PriceBook = {
  id: string;
  name: string;
  validFrom: string;
  validTo: string;
  active: boolean;
  branchIds: string[] | null;
  customerGroupIds: string[] | null;
  sellerIds: string[] | null;
  missingPolicy: MissingPolicy;
  autoUpdate: boolean;
  autoOp: FormulaOp;
  autoValue: number;
  autoPercent: boolean;
  itemCount: number;
  createdByName: string;
  createdAt: string;
};

export type PriceBookRequest = Omit<PriceBook, "id" | "itemCount" | "createdByName" | "createdAt">;

/** 1 dòng = 1 đơn vị tính. prices: bookId → giá (thiếu = chưa có trong bảng giá). */
export type PriceRow = {
  unitId: string;
  productId: string;
  code: string;
  name: string;
  unitName: string;
  cost: number;
  lastPurchasePrice: number | null;
  basePrice: number;
  prices: Record<string, number>;
};

export type PriceRowFilters = { q: string; categoryIds: string[]; stock: string; inBookOnly: boolean };

export type FormulaRequest = {
  base: FormulaBase;
  baseBookId: string | null;
  op: FormulaOp;
  value: number;
  percent: boolean;
  onlyExisting: boolean;
  q: string;
  categoryIds: string[];
  stock: string;
};

export type ImportError = { line: number; code: string; message: string };
export type ImportResult = { updated: number; errors: ImportError[] };
export type CustomerGroupRef = { id: string; name: string };
