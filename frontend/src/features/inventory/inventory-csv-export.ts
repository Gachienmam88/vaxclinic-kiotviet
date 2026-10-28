/** "Xuất file" phía trình duyệt cho Kiểm kho / Xuất hủy / Xuất dùng nội bộ: CSV từ dữ liệu đang hiển thị. */
import { downloadCsv } from "@/features/accounting/tax-calc";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  ISSUE_CONFIG, ISSUE_STATUS_LABEL, TAKE_STATUS_LABEL, type IssueListItem, type IssueType, type StockIssue,
  type StockTake, type TakeListItem,
} from "./inventory-types";

const num = (v: number | string | null | undefined) => Number(v ?? 0);
const stamp = () => new Date().toISOString().slice(0, 10);

export function exportStockTakesCsv(items: TakeListItem[], branchName: (id: string) => string) {
  downloadCsv(`kiem-kho-${stamp()}.csv`,
    ["Mã kiểm kho", "Thời gian", "Ngày cân bằng", "Chi nhánh", "SL thực tế", "Tổng thực tế", "Tổng chênh lệch",
      "SL lệch tăng", "SL lệch giảm", "Người tạo", "Ghi chú", "Trạng thái"],
    items.map((t) => [t.code, formatDateTime(t.takenAt), formatDateTime(t.balancedAt), branchName(t.branchId),
      num(t.actualQuantity), num(t.actualValue), num(t.diffValue), num(t.increaseQuantity), num(t.decreaseQuantity),
      t.createdByName, t.note ?? "", TAKE_STATUS_LABEL[t.status]]));
}

export function exportStockTakeLinesCsv(t: StockTake) {
  downloadCsv(`${t.code}.csv`,
    ["Mã hàng", "Tên hàng", "ĐVT", "Số lô", "Hạn sử dụng", "Tồn kho", "Thực tế", "SL lệch", "Giá trị lệch"],
    t.lines.map((l) => [l.productCode, l.productName, l.unitName, l.lotNumber ?? "", formatDate(l.expiryDate),
      num(l.systemQuantity), l.actualQuantity == null ? "" : num(l.actualQuantity), num(l.diffQuantity), num(l.diffValue)]));
}

export function exportStockIssuesCsv(type: IssueType, items: IssueListItem[], branchName: (id: string) => string) {
  const cfg = ISSUE_CONFIG[type];
  downloadCsv(`${cfg.file}-${stamp()}.csv`,
    [cfg.codeLabel, cfg.valueLabel, "Thời gian", "Chi nhánh", "Lý do", "Người tạo", "Ghi chú", "Trạng thái"],
    items.map((d) => [d.code, num(d.totalValue), formatDateTime(d.issuedAt), branchName(d.branchId), d.reason ?? "",
      d.createdByName, d.note ?? "", ISSUE_STATUS_LABEL[d.status]]));
}

export function exportStockIssueLinesCsv(d: StockIssue) {
  const cfg = ISSUE_CONFIG[d.type];
  downloadCsv(`${d.code}.csv`,
    ["Mã hàng", "Tên hàng", "ĐVT", "Số lô", "Hạn sử dụng", cfg.qtyLabel, "Giá vốn", cfg.lineValueLabel],
    d.lines.map((l) => [l.productCode, l.productName, l.unitName, l.lotNumber ?? "", formatDate(l.expiryDate),
      num(l.quantity), num(l.unitCost), num(l.value)]));
}
