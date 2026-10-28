/**
 * "Xuất file" phía trình duyệt: CSV (UTF-8 có BOM) từ dữ liệu đang hiển thị — không gọi API mới.
 * Phiếu nhập / trả hàng nhập là chứng từ nghiệp vụ (không phải sổ thuế, không nhập lại) → tiêu đề theo ngôn ngữ đang chọn.
 */
import { downloadCsv } from "@/features/accounting/tax-calc";
import { formatDateTime } from "@/lib/format";
import type { TFunction } from "@/lib/i18n";
import type { commonNs } from "@/messages/common";
import {
  receiptStatusLabels, returnStatusLabels, type PurchasesT, type Receipt, type ReceiptListItem, type ReturnListItem,
} from "./purchase-types";

type CommonT = TFunction<(typeof commonNs)["vi"]>;

const num = (v: number | string | null | undefined) => Number(v ?? 0);
const stamp = () => new Date().toISOString().slice(0, 10);

export function exportReceiptsCsv(items: ReceiptListItem[], t: PurchasesT, tc: CommonT) {
  const status = receiptStatusLabels(t);
  downloadCsv(`nhap-hang-${stamp()}.csv`,
    [t("receipts.cols.code"), t("receipts.cols.time"), t("receipts.cols.supplierCode"), t("receipts.cols.supplier"),
      t("receipts.cols.vat"), t("receipts.cols.due"), t("receipts.cols.paid"), t("receipts.cols.subtotal"),
      t("receipts.cols.discount"), t("receipts.cols.inputInvoiceNo"), t("receipts.receiver"), tc("fields.createdBy"), tc("fields.status")],
    items.map((r) => [r.code, formatDateTime(r.receivedAt), r.supplierCode ?? "", r.supplierName ?? "", num(r.vatAmount),
      num(r.total), num(r.paidAmount), num(r.subtotal), num(r.discount), r.inputInvoiceNo ?? "", r.receiverName ?? "",
      r.createdByName, status[r.status]]));
}

export function exportReturnsCsv(items: ReturnListItem[], t: PurchasesT, tc: CommonT) {
  const status = returnStatusLabels(t);
  downloadCsv(`tra-hang-nhap-${stamp()}.csv`,
    [t("returns.cols.code"), t("receipts.cols.time"), t("receipts.cols.supplier"), t("receipts.cols.subtotal"),
      t("receipts.cols.discount"), "VAT", t("returns.cols.supplierDue"), t("returns.cols.supplierPaid"),
      t("returns.cols.byReceipt"), t("returns.returner"), tc("fields.status")],
    items.map((r) => [r.code, formatDateTime(r.returnedAt), r.supplierName ?? "", num(r.subtotal), num(r.discount),
      num(r.vatAmount), num(r.total), num(r.refundAmount), r.receiptCode ?? "", r.returnerName ?? "", status[r.status]]));
}

/** Chi tiết 1 phiếu nhập (nút "Xuất file" trong dòng mở rộng). */
export function exportReceiptLinesCsv(r: Receipt, t: PurchasesT) {
  downloadCsv(`${r.code}.csv`,
    [t("lines.productCode"), t("lines.productName"), t("lines.unit"), t("lines.lotNumber"), t("lines.expiry"),
      t("lines.quantity"), t("lines.unitPrice"), t("lines.discount"), t("lines.priceWithVat"), t("lines.amount")],
    r.lines.map((l) => [l.productCode, l.productName, l.unitName, l.lotNumber ?? "", l.expiryDate ?? "", num(l.quantity),
      num(l.unitPrice), num(l.discount), num(l.priceWithVat), num(l.amount)]));
}
