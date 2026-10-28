import { api } from "@/lib/api-client";
import { formatDateTime, formatNumber } from "@/lib/format";
import { downloadCsv } from "./invoice-list-pager";
import { stateLabel } from "./invoice-filter-model";
import { methodLabel, type Invoice, type InvoiceListItem } from "./sales-types";

/** "Xuất file tổng quan": mỗi hóa đơn 1 dòng (các dòng đang hiển thị). */
export function exportInvoiceSummary(items: InvoiceListItem[]) {
  downloadCsv("danh-sach-hoa-don", ["Mã hóa đơn", "Thời gian", "Mã trả hàng", "Mã KH", "Khách hàng", "Người bán", "Tổng tiền hàng",
    "Giảm giá", "Khách cần trả", "Khách đã trả", "Phương thức", "Trạng thái"], items.map((i) => [i.code, formatDateTime(i.soldAt),
    i.returnCodes, i.customerCode, i.customerName, i.sellerName, i.subtotal, i.discount, i.total, i.paid, methodLabel(i.paymentMethod),
    stateLabel(i.state)]));
}

const LINE_HEAD = ["Mã hàng", "Tên hàng", "ĐVT", "Số lượng", "Đơn giá", "Giảm giá", "Giá bán", "Thành tiền"];
const lineRow = (l: Invoice["lines"][number]) =>
  [l.productCode, l.productName, l.unitName, formatNumber(l.quantity), l.unitPrice, l.discount, l.price, l.amount];

/** "Xuất file chi tiết": mỗi dòng hàng 1 dòng, kèm thông tin hóa đơn (tải chi tiết từng hóa đơn đang hiển thị). */
export async function exportInvoiceDetails(items: InvoiceListItem[]) {
  const invs = await Promise.all(items.map((i) => api<Invoice>(`/invoices/${i.id}`)));
  downloadCsv("chi-tiet-hoa-don", ["Mã hóa đơn", "Thời gian", "Mã KH", "Khách hàng", "Kênh bán", "Ghi chú", ...LINE_HEAD],
    invs.flatMap((inv) => inv.lines.map((l) => [inv.code, formatDateTime(inv.soldAt), inv.customerCode, inv.customerName,
      inv.salesChannelName, inv.note, ...lineRow(l)])));
}

/** Nút "Xuất file" trong chi tiết 1 hóa đơn: thông tin chung + dòng hàng + tổng. */
export function exportOneInvoice(inv: Invoice) {
  const head: (string | number | null)[][] = [["Thời gian", formatDateTime(inv.soldAt)],
    ["Khách hàng", [inv.customerCode, inv.customerName].filter(Boolean).join(" - ")], ["Người bán", inv.sellerName],
    ["Kênh bán", inv.salesChannelName], ["Bảng giá", inv.priceBookName ?? "Bảng giá chung"], ["Ghi chú", inv.note], []];
  const totals = [[], ["Tổng tiền hàng", inv.subtotal], ["Giảm giá hóa đơn", inv.discount], ["Khách cần trả", inv.total],
    ["Khách đã trả", inv.paid]];
  downloadCsv(`hoa-don-${inv.code}`, ["Mã hóa đơn", inv.code], [...head, LINE_HEAD, ...inv.lines.map(lineRow), ...totals]);
}
