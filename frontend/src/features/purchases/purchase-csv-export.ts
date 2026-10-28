/** "Xuất file" phía trình duyệt: CSV (UTF-8 có BOM) từ dữ liệu đang hiển thị — không gọi API mới. */
import { downloadCsv } from "@/features/accounting/tax-calc";
import { formatDateTime } from "@/lib/format";
import {
  RECEIPT_STATUS_LABEL, RETURN_STATUS_LABEL, type Receipt, type ReceiptListItem, type ReturnListItem,
} from "./purchase-types";

const num = (v: number | string | null | undefined) => Number(v ?? 0);
const stamp = () => new Date().toISOString().slice(0, 10);

export function exportReceiptsCsv(items: ReceiptListItem[]) {
  downloadCsv(`nhap-hang-${stamp()}.csv`,
    ["Mã nhập hàng", "Thời gian", "Mã NCC", "Nhà cung cấp", "VAT nhập hàng", "Cần trả NCC", "Tiền đã trả NCC",
      "Tổng tiền hàng", "Giảm giá", "Số HĐ đầu vào", "Người nhập", "Người tạo", "Trạng thái"],
    items.map((r) => [r.code, formatDateTime(r.receivedAt), r.supplierCode ?? "", r.supplierName ?? "", num(r.vatAmount),
      num(r.total), num(r.paidAmount), num(r.subtotal), num(r.discount), r.inputInvoiceNo ?? "", r.receiverName ?? "",
      r.createdByName, RECEIPT_STATUS_LABEL[r.status]]));
}

export function exportReturnsCsv(items: ReturnListItem[]) {
  downloadCsv(`tra-hang-nhap-${stamp()}.csv`,
    ["Mã trả hàng nhập", "Thời gian", "Nhà cung cấp", "Tổng tiền hàng", "Giảm giá", "VAT", "NCC cần trả",
      "NCC đã trả", "Theo phiếu nhập", "Người trả", "Trạng thái"],
    items.map((r) => [r.code, formatDateTime(r.returnedAt), r.supplierName ?? "", num(r.subtotal), num(r.discount),
      num(r.vatAmount), num(r.total), num(r.refundAmount), r.receiptCode ?? "", r.returnerName ?? "", RETURN_STATUS_LABEL[r.status]]));
}

/** Chi tiết 1 phiếu nhập (nút "Xuất file" trong dòng mở rộng). */
export function exportReceiptLinesCsv(r: Receipt) {
  downloadCsv(`${r.code}.csv`,
    ["Mã hàng", "Tên hàng", "ĐVT", "Số lô", "Hạn sử dụng", "Số lượng", "Đơn giá", "Giảm giá", "Giá nhập có VAT", "Thành tiền"],
    r.lines.map((l) => [l.productCode, l.productName, l.unitName, l.lotNumber ?? "", l.expiryDate ?? "", num(l.quantity),
      num(l.unitPrice), num(l.discount), num(l.priceWithVat), num(l.amount)]));
}
