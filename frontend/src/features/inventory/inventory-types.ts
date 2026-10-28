/** Kiểu dữ liệu khớp InventoryDocDtos của product-service (kiểm kho, xuất hủy, xuất dùng nội bộ). */

export type TakeStatus = "DRAFT" | "BALANCED" | "CANCELLED";
export type IssueStatus = "DRAFT" | "COMPLETED" | "CANCELLED";
export type IssueType = "DAMAGE" | "INTERNAL";

export const TAKE_STATUS_LABEL: Record<TakeStatus, string> = {
  DRAFT: "Phiếu tạm", BALANCED: "Đã cân bằng kho", CANCELLED: "Đã hủy",
};
export const ISSUE_STATUS_LABEL: Record<IssueStatus, string> = {
  DRAFT: "Phiếu tạm", COMPLETED: "Hoàn thành", CANCELLED: "Đã hủy",
};

/** Nhãn + đường dẫn theo loại phiếu xuất (KiotViet: "Mã xuất hủy / SL hủy" vs "Mã phiếu / SL xuất"). */
export const ISSUE_CONFIG = {
  DAMAGE: {
    title: "Xuất hủy", codeLabel: "Mã xuất hủy", valueLabel: "Tổng giá trị hủy", qtyLabel: "SL hủy",
    lineValueLabel: "Giá trị hủy", listPath: "/inventory/damages", file: "xuat-huy",
  },
  INTERNAL: {
    title: "Xuất dùng nội bộ", codeLabel: "Mã phiếu", valueLabel: "Tổng giá trị", qtyLabel: "SL xuất",
    lineValueLabel: "Giá trị", listPath: "/inventory/internal-use", file: "xuat-dung-noi-bo",
  },
} as const;

export type TakeLine = {
  id: string; lineNo: number; productId: string; productCode: string; productName: string; unitName: string;
  lotManaged: boolean; lotNumber: string | null; expiryDate: string | null; systemQuantity: number;
  actualQuantity: number | null; diffQuantity: number; cost: number; diffValue: number;
};

export type StockTake = {
  id: string; code: string; branchId: string; status: TakeStatus; takenAt: string; balancedAt: string | null;
  createdBy: string; createdByName: string; note: string | null; actualQuantity: number; actualValue: number;
  diffValue: number; increaseQuantity: number; decreaseQuantity: number; lines: TakeLine[];
};

export type TakeListItem = Omit<StockTake, "lines" | "createdBy">;

export type IssueLine = {
  id: string; lineNo: number; productId: string; productCode: string; productName: string; unitId: string;
  unitName: string; conversionRate: number; quantity: number; unitCost: number; value: number;
  lotNumber: string | null; expiryDate: string | null;
};

export type StockIssue = {
  id: string; code: string; type: IssueType; branchId: string; status: IssueStatus; issuedAt: string;
  createdBy: string; createdByName: string; reason: string | null; note: string | null; totalQuantity: number;
  totalValue: number; completedAt: string | null; cancelledAt: string | null; lines: IssueLine[];
};

export type IssueListItem = Omit<StockIssue, "lines" | "createdBy" | "completedAt" | "cancelledAt">;
