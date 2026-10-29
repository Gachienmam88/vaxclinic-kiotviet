/** Kiểu dữ liệu Thiết lập giá (khớp PriceBookDtos ở product-service). */

/** Hàng không có trong bảng giá: ALLOW = dùng giá chung, BLOCK = chặn, WARN = cho phép kèm cảnh báo. */
export type MissingPolicy = "ALLOW" | "BLOCK" | "WARN";
export type FormulaOp = "PLUS" | "MINUS";
/** CURRENT = giá hiện tại của chính cột đang đặt giá (chỉ dùng cho "Đặt giá theo công thức"). */
export type FormulaBase = "BASE_PRICE" | "COST" | "LAST_PURCHASE" | "BOOK" | "CURRENT";
/** Lọc "Giá bán": so sánh giá với giá vốn / giá nhập cuối. Nhãn: t(`priceFilter.op.${k}`), t(`formulaBase.${k}`). */
export type PriceCompare = "LT" | "LTE" | "EQ" | "GTE" | "GT";
export type CompareWith = "COST" | "LAST_PURCHASE";
export const PRICE_COMPARES: PriceCompare[] = ["LT", "LTE", "EQ", "GTE", "GT"];
export const COMPARE_WITHS: CompareWith[] = ["COST", "LAST_PURCHASE"];

/** Cột / chip "Bảng giá chung" (giá chung của đơn vị tính) trong danh sách bảng giá đang chọn. */
export const BASE_BOOK_ID = "__base__";

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
  /** Công thức giá của bảng giá: null = không có (autoUpdate cũ = theo giá chung). */
  autoBase: Exclude<FormulaBase, "CURRENT"> | null;
  autoBaseBookId: string | null;
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

/** code / name: ô tìm dưới tiêu đề bảng; priceOp + compareWith: lọc "Giá bán" ("" = không lọc). */
export type PriceRowFilters = {
  q: string; code: string; name: string; categoryIds: string[]; stock: string; inBookOnly: boolean;
  priceOp: PriceCompare | ""; compareWith: CompareWith | "";
};

export type FormulaRequest = {
  base: FormulaBase;
  baseBookId: string | null;
  op: FormulaOp;
  value: number;
  percent: boolean;
  onlyExisting: boolean;
  /** null = mọi dòng thuộc bộ lọc; [unitId] = chỉ hàng này. */
  unitIds: string[] | null;
  q: string;
  code: string;
  name: string;
  categoryIds: string[];
  stock: string;
  priceOp: PriceCompare | null;
  compareWith: CompareWith | null;
  compareBookId: string | null;
};

export type ImportError = { line: number; code: string; message: string };
export type ImportResult = { updated: number; errors: ImportError[] };
export type CustomerGroupRef = { id: string; name: string };
