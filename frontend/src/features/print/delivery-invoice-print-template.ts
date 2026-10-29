import type { Invoice } from "@/features/sales/sales-types";
import { formatMoney, formatNumber } from "@/lib/format";
import { joinAddress } from "@/lib/vn-admin-search";
import { invoiceData } from "./print-data";
import type { PrintData } from "./print-render";

/**
 * Mẫu in hóa đơn giao hàng (in sau khi thanh toán ở Bán giao hàng): logo + tên cửa hàng, địa chỉ / hotline / MST, số HĐ;
 * khung Khách hàng / SĐT / Địa chỉ người nhận, bên phải SĐT / địa chỉ cửa hàng; bảng TT | Tên Hàng | SL | Đơn giá | Thành tiền,
 * dòng Cộng, Tổng Cộng; ngày + NGƯỜI BÁN HÀNG; lời cảm ơn. Dùng dữ liệu cửa hàng ở Thiết lập (không dùng thương hiệu khác).
 * Render qua renderTemplate (escape) rồi printHtml (sanitizeHtml).
 */
export const DELIVERY_INVOICE_TEMPLATE = `<table><tr>
<td style="width:40%;vertical-align:middle">{Logo}</td>
<td class="c"><h3 style="font-size:15px">{Ten_Cua_Hang}</h3><p>{Dia_Chi_Cua_Hang}</p><p><b>Hotline: {Dien_Thoai_Cua_Hang}</b></p>
<p><b>MST: {MST_Cua_Hang}</b></p><p><b>Số HĐ: {Ma_Hoa_Don}</b></p></td>
</tr></table>
<table style="margin-top:8px"><tr>
<td style="width:55%;vertical-align:top">
<div style="border:1px solid #000;border-radius:4px;padding:3px 5px;margin-bottom:3px"><b>Khách hàng: {Nguoi_Nhan}</b></div>
<div style="border:1px solid #000;border-radius:4px;padding:3px 5px"><b>SĐT: {SDT_Nguoi_Nhan}</b></div>
</td>
<td style="vertical-align:top;padding-left:6px"><p><b>SĐT: {Dien_Thoai_Cua_Hang}</b></p><p><b>Địa chỉ: {Dia_Chi_Cua_Hang}</b></p></td>
</tr></table>
<div style="border:1px solid #000;border-radius:4px;padding:3px 5px;margin-top:3px"><b>Địa chỉ: {Dia_Chi_Giao_Hang}</b></div>
<table class="lines" style="margin-top:10px">
<tr><th style="width:7%">TT</th><th>Tên Hàng</th><th style="width:10%">SL</th><th style="width:17%">Đơn giá</th><th style="width:19%">Thành tiền</th></tr>
{#Dong_Hang}<tr><td class="c">{STT}</td><td><b>{Ten_Hang}</b></td><td class="c">{So_Luong}</td><td class="r">{Don_Gia}</td><td class="r">{Thanh_Tien}</td></tr>{/Dong_Hang}
<tr><td></td><td class="c"><b>Cộng</b></td><td class="c">{Tong_So_Luong}</td><td></td><td class="r">{Tong_Tien_Hang}</td></tr>
<tr><td></td><td class="c"><b>Tổng Cộng</b></td><td></td><td></td><td class="r"><b>{Tong_Cong}</b></td></tr>
<tr><td colspan="5" style="height:18px"></td></tr>
</table>
<table style="margin-top:6px"><tr><td style="width:50%"></td>
<td class="c"><i>Ngày {Ngay} tháng {Thang} năm {Nam}</i><br><b>NGƯỜI BÁN HÀNG</b></td></tr></table>
<p class="c" style="margin-top:40px"><i>Cảm ơn quý khách, hẹn gặp lại!</i></p>`;

/** Dữ liệu in hóa đơn giao hàng: trường hóa đơn + người nhận (tên, SĐT, địa chỉ giao), mã vận đơn, thu hộ. */
export function deliveryInvoiceData(inv: Invoice): PrintData {
  const s = inv.shipment;
  return {
    ...invoiceData(inv),
    Nguoi_Nhan: s?.receiverName ?? inv.customerName, SDT_Nguoi_Nhan: s?.receiverPhone ?? inv.customerPhone ?? "",
    Dia_Chi_Giao_Hang: s ? joinAddress(s.receiverAddress, s.area) : inv.customerAddress ?? "",
    Ma_Van_Don: s?.code ?? "", Thu_Ho: formatMoney(s?.codAmount ?? 0),
    Tong_So_Luong: formatNumber(inv.lines.reduce((n, l) => n + Number(l.quantity), 0)),
  };
}
