import { formatDateTime, formatNumber } from "@/lib/format";
import { downloadCsv } from "./invoice-list-pager";
import type { Invoice } from "./sales-types";

const LINE_HEAD = ["Mã hàng", "Tên hàng", "ĐVT", "Số lượng", "Đơn giá", "Giảm giá", "Giá bán", "Thành tiền"];
const lineRow = (l: Invoice["lines"][number]) =>
  [l.productCode, l.productName, l.unitName, formatNumber(l.quantity), l.unitPrice, l.discount, l.price, l.amount];

/** Nút "Xuất file" trong chi tiết 1 hóa đơn: thông tin chung + dòng hàng + tổng. */
export function exportOneInvoice(inv: Invoice) {
  const head: (string | number | null)[][] = [["Thời gian", formatDateTime(inv.soldAt)],
    ["Khách hàng", [inv.customerCode, inv.customerName].filter(Boolean).join(" - ")], ["Người bán", inv.sellerName],
    ["Kênh bán", inv.salesChannelName], ["Bảng giá", inv.priceBookName ?? "Bảng giá chung"], ["Ghi chú", inv.note], []];
  const totals = [[], ["Tổng tiền hàng", inv.subtotal], ["Giảm giá hóa đơn", inv.discount], ["Khách cần trả", inv.total],
    ["Khách đã trả", inv.paid]];
  downloadCsv(`hoa-don-${inv.code}`, ["Mã hóa đơn", inv.code], [...head, LINE_HEAD, ...inv.lines.map(lineRow), ...totals]);
}
