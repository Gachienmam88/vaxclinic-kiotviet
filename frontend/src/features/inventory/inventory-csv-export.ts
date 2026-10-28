/**
 * "Xuất file" phía trình duyệt cho Kiểm kho / Xuất hủy / Xuất dùng nội bộ: CSV từ dữ liệu đang hiển thị.
 * Tiêu đề cột + trạng thái theo ngôn ngữ đang chọn (file chỉ để xem, không nhập lại / không dùng cho kê khai).
 */
import { downloadCsv } from "@/features/accounting/tax-calc";
import type { TFunction } from "@/lib/i18n";
import { formatDate, formatDateTime } from "@/lib/format";
import type { inventoryNs } from "@/messages/inventory";
import {
  ISSUE_CONFIG, ISSUE_STATUS_KEY, TAKE_STATUS_KEY, type IssueListItem, type IssueType, type StockIssue,
  type StockTake, type TakeListItem,
} from "./inventory-types";

type T = TFunction<typeof inventoryNs.vi>;

const num = (v: number | string | null | undefined) => Number(v ?? 0);
const stamp = () => new Date().toISOString().slice(0, 10);

export function exportStockTakesCsv(t: T, items: TakeListItem[], branchName: (id: string) => string) {
  downloadCsv(`kiem-kho-${stamp()}.csv`,
    [t("fields.takeCode"), t("fields.time"), t("fields.balancedAt"), t("fields.branch"), t("fields.actualQty"),
      t("fields.actualTotal"), t("fields.diffTotal"), t("fields.increaseQty"), t("fields.decreaseQty"),
      t("fields.createdBy"), t("fields.note"), t("fields.status")],
    items.map((x) => [x.code, formatDateTime(x.takenAt), formatDateTime(x.balancedAt), branchName(x.branchId),
      num(x.actualQuantity), num(x.actualValue), num(x.diffValue), num(x.increaseQuantity), num(x.decreaseQuantity),
      x.createdByName, x.note ?? "", t(TAKE_STATUS_KEY[x.status])]));
}

export function exportStockTakeLinesCsv(t: T, doc: StockTake) {
  downloadCsv(`${doc.code}.csv`,
    [t("fields.productCode"), t("fields.productName"), t("fields.unit"), t("fields.lotNumber"), t("fields.expiryDate"),
      t("fields.stock"), t("fields.actual"), t("fields.diffQty"), t("fields.diffValue")],
    doc.lines.map((l) => [l.productCode, l.productName, l.unitName, l.lotNumber ?? "", formatDate(l.expiryDate),
      num(l.systemQuantity), l.actualQuantity == null ? "" : num(l.actualQuantity), num(l.diffQuantity), num(l.diffValue)]));
}

export function exportStockIssuesCsv(t: T, type: IssueType, items: IssueListItem[], branchName: (id: string) => string) {
  const cfg = ISSUE_CONFIG[type];
  downloadCsv(`${cfg.file}-${stamp()}.csv`,
    [t(`issue.${cfg.msg}.codeLabel`), t(`issue.${cfg.msg}.valueLabel`), t("fields.time"), t("fields.branch"),
      t("fields.reason"), t("fields.createdBy"), t("fields.note"), t("fields.status")],
    items.map((d) => [d.code, num(d.totalValue), formatDateTime(d.issuedAt), branchName(d.branchId), d.reason ?? "",
      d.createdByName, d.note ?? "", t(ISSUE_STATUS_KEY[d.status])]));
}

export function exportStockIssueLinesCsv(t: T, d: StockIssue) {
  const cfg = ISSUE_CONFIG[d.type];
  downloadCsv(`${d.code}.csv`,
    [t("fields.productCode"), t("fields.productName"), t("fields.unit"), t("fields.lotNumber"), t("fields.expiryDate"),
      t(`issue.${cfg.msg}.qtyLabel`), t("fields.cost"), t(`issue.${cfg.msg}.lineValueLabel`)],
    d.lines.map((l) => [l.productCode, l.productName, l.unitName, l.lotNumber ?? "", formatDate(l.expiryDate),
      num(l.quantity), num(l.unitCost), num(l.value)]));
}
