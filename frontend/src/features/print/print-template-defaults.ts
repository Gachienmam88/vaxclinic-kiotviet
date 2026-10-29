import type viPrint from "@/messages/vi/print.json";

/** 7 loại mẫu in A5: trường dùng được, dữ liệu mẫu để xem trước, mẫu mặc định. */
export type PrintType = "INVOICE" | "DELIVERY_INVOICE" | "SALES_RETURN" | "CASH_RECEIPT" | "CASH_PAYMENT" | "PURCHASE_RECEIPT" | "PURCHASE_RETURN";

/** Khóa nhãn trường trong namespace print: hiển thị bằng t(`fields.${label}`) (mã trường {Ten_Truong} giữ nguyên). */
export type PrintFieldLabel = keyof typeof viPrint.fields;
type Field = [string, PrintFieldLabel];
/** label/group: tiếng Việt (giữ cho chỗ cũ); UI đa ngôn ngữ dùng t(`types.${type}`) / t(`groups.${groupKey}`) của namespace print. */
type Def = { label: string; group: string; groupKey: keyof typeof viPrint.groups; fields: Field[]; lineFields: Field[]; template: string };

const STORE: Field[] = [
  ["Logo", "storeLogo"], ["Ten_Cua_Hang", "storeName"], ["Dia_Chi_Cua_Hang", "storeAddress"],
  ["Dien_Thoai_Cua_Hang", "storePhone"], ["MST_Cua_Hang", "storeTaxCode"], ["Ten_Chi_Nhanh", "branch"],
  ["Ngay", "printDay"], ["Thang", "printMonth"], ["Nam", "printYear"], ["Nguoi_Tao", "createdBy"],
];
const LINE: Field[] = [
  ["STT", "lineNo"], ["Ma_Hang", "productCode"], ["Ten_Hang", "productName"], ["Don_Vi", "unit"], ["So_Luong", "quantity"],
  ["Don_Gia", "unitPrice"], ["Thanh_Tien", "amount"], ["So_Lo", "lotNumber"],
];

const HEADER = `<table><tr>
<td style="width:30%">{Logo}</td>
<td class="c"><h3>{Ten_Cua_Hang}</h3><p>{Dia_Chi_Cua_Hang}</p><p>ĐT: {Dien_Thoai_Cua_Hang}</p></td>
</tr></table>`;

const SIGN = (left: string, right: string) => `<table style="margin-top:12px"><tr>
<td class="c" style="width:50%"><b>${left}</b><br><i>(Ký, họ tên)</i></td>
<td class="c"><i>Ngày {Ngay} tháng {Thang} năm {Nam}</i><br><b>${right}</b><br><i>(Ký, họ tên)</i></td>
</tr></table>`;

const LINES_TABLE = (extraHead = "", extraCell = "") => `<table class="lines" style="margin-top:6px">
<tr><th>STT</th><th>Tên hàng</th>${extraHead}<th>ĐVT</th><th>SL</th><th>Đơn giá</th><th>Thành tiền</th></tr>
{#Dong_Hang}<tr><td class="c">{STT}</td><td>{Ten_Hang}</td>${extraCell}<td class="c">{Don_Vi}</td><td class="r">{So_Luong}</td><td class="r">{Don_Gia}</td><td class="r">{Thanh_Tien}</td></tr>{/Dong_Hang}
</table>`;

const VOUCHER = (title: string, person: string, signer: string) => `${HEADER}
<h2 class="c" style="margin-top:8px">${title}</h2>
<p class="c">Mã phiếu: <b>{Ma_Phieu}</b> — Ngày: {Ngay_Tao}</p>
<table style="margin-top:8px">
<tr><td style="width:35%">Họ tên ${person}:</td><td><b>{Doi_Tuong}</b></td></tr>
<tr><td>Số điện thoại:</td><td>{SDT_Doi_Tuong}</td></tr>
<tr><td>Lý do:</td><td>{Loai_Thu_Chi}</td></tr>
<tr><td>Số tiền:</td><td><b>{So_Tien}</b></td></tr>
<tr><td>Bằng chữ:</td><td><i>{So_Tien_Bang_Chu}</i></td></tr>
<tr><td>Hình thức:</td><td>{Quy}</td></tr>
<tr><td>Ghi chú:</td><td>{Ghi_Chu}</td></tr>
</table>
<table style="margin-top:12px"><tr>
<td class="c"><b>Người lập phiếu</b></td><td class="c"><b>${signer}</b></td><td class="c"><b>Thủ quỹ</b></td>
</tr></table>`;

/** Giảm thuế (Nghị quyết 204/2025/QH15) + "Bán thuốc theo đơn". */
const TAX_RX: Field[] = [["Giam_Thue", "taxReduction"], ["Phuong_Phap_Giam_Thue", "taxReductionMethod"], ["Thong_Tin_Don_Thuoc", "prescriptionSummary"],
  ["Ma_Don_Thuoc", "prescriptionCode"], ["Bac_Si_Ke_Don", "prescriber"], ["Co_So_Kham", "clinic"], ["Chan_Doan", "diagnosis"]];

/**
 * Hóa đơn giao hàng (in sau khi thanh toán ở Bán giao hàng): logo + tên cửa hàng, địa chỉ / hotline / MST, số HĐ; khung
 * Khách hàng / SĐT / Địa chỉ người nhận, bên phải SĐT / địa chỉ cửa hàng; bảng TT | Tên Hàng | SL | Đơn giá | Thành tiền,
 * Cộng, Tổng Cộng; ngày + NGƯỜI BÁN HÀNG. Dữ liệu cửa hàng lấy từ Thiết lập (không dùng thương hiệu khác).
 */
const DELIVERY_INVOICE_TEMPLATE = `<table><tr>
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
<tr><td></td><td class="c">Giảm thuế {Phuong_Phap_Giam_Thue}</td><td></td><td></td><td class="r">{Giam_Thue}</td></tr>
<tr><td></td><td class="c"><b>Tổng Cộng</b></td><td></td><td></td><td class="r"><b>{Tong_Cong}</b></td></tr>
<tr><td colspan="5" style="height:18px"></td></tr>
</table>
<table style="margin-top:6px"><tr><td style="width:50%"></td>
<td class="c"><i>Ngày {Ngay} tháng {Thang} năm {Nam}</i><br><b>NGƯỜI BÁN HÀNG</b></td></tr></table>
<p class="c" style="margin-top:40px"><i>Cảm ơn quý khách, hẹn gặp lại!</i></p>`;

export const PRINT_DEFS: Record<PrintType, Def> = {
  INVOICE: {
    label: "Hóa đơn", group: "Đơn hàng", groupKey: "orders",
    fields: [...STORE, ["Ma_Hoa_Don", "invoiceCode"], ["Ngay_Ban", "soldAt"], ["Khach_Hang", "customer"],
      ["Ma_Khach_Hang", "customerCode"], ["SDT_Khach_Hang", "customerPhone"], ["Dia_Chi_Khach_Hang", "customerAddress"],
      ["Dia_Chi_Giao_Hang", "shippingAddress"], ["Nguoi_Ban", "seller"],
      ["Tong_So_Luong", "totalQuantity"], ["Tong_Tien_Hang", "subtotal"], ["Giam_Gia", "invoiceDiscount"],
      ["Tong_Cong", "total"], ["Tong_Cong_Bang_Chu", "totalInWords"], ["Khach_Da_Tra", "customerPaid"],
      ["Con_No", "remainingDebt"], ["PT_Thanh_Toan", "paymentMethod"], ["Ghi_Chu", "note"], ...TAX_RX],
    lineFields: [...LINE, ["Chiet_Khau", "lineDiscount"]],
    template: `${HEADER}
<h2 class="c" style="margin-top:8px">HÓA ĐƠN BÁN HÀNG</h2>
<p class="c">Số: <b>{Ma_Hoa_Don}</b> — {Ngay_Ban}</p>
<p>Khách hàng: <b>{Khach_Hang}</b> — SĐT: {SDT_Khach_Hang}</p>
<p>Địa chỉ: {Dia_Chi_Khach_Hang}</p>
<p>{Thong_Tin_Don_Thuoc}</p>
${LINES_TABLE("<th>Số lô</th>", "<td>{So_Lo}</td>")}
<table style="margin-top:4px">
<tr><td class="r">Tổng tiền hàng:</td><td class="r" style="width:30%">{Tong_Tien_Hang}</td></tr>
<tr><td class="r">Giảm giá:</td><td class="r">{Giam_Gia}</td></tr>
<tr><td class="r">Giảm thuế {Phuong_Phap_Giam_Thue}:</td><td class="r">{Giam_Thue}</td></tr>
<tr><td class="r"><b>Tổng cộng:</b></td><td class="r"><b>{Tong_Cong}</b></td></tr>
<tr><td class="r">Khách đã trả:</td><td class="r">{Khach_Da_Tra}</td></tr>
<tr><td class="r">Còn nợ:</td><td class="r">{Con_No}</td></tr>
</table>
<p><i>Bằng chữ: {Tong_Cong_Bang_Chu}</i></p>
${SIGN("Khách hàng", "Người bán hàng")}
<p class="c" style="margin-top:8px"><i>Cảm ơn quý khách, hẹn gặp lại!</i></p>`,
  },
  DELIVERY_INVOICE: {
    label: "Hóa đơn giao hàng", group: "Đơn hàng", groupKey: "orders",
    fields: [...STORE, ["Ma_Hoa_Don", "invoiceCode"], ["Ngay_Ban", "soldAt"], ["Khach_Hang", "customer"],
      ["Nguoi_Nhan", "receiverName"], ["SDT_Nguoi_Nhan", "receiverPhone"], ["Dia_Chi_Giao_Hang", "shippingAddress"],
      ["Ma_Van_Don", "shipmentCode"], ["Thu_Ho", "codAmount"], ["Nguoi_Ban", "seller"], ["Tong_So_Luong", "totalQuantity"],
      ["Tong_Tien_Hang", "subtotal"], ["Giam_Gia", "invoiceDiscount"], ["Tong_Cong", "total"], ["Khach_Da_Tra", "customerPaid"],
      ["Ghi_Chu", "note"], ...TAX_RX],
    lineFields: LINE,
    template: DELIVERY_INVOICE_TEMPLATE,
  },
  SALES_RETURN: {
    label: "Trả hàng", group: "Đơn hàng", groupKey: "orders",
    fields: [...STORE, ["Ma_Tra_Hang", "returnCode"], ["Ma_Hoa_Don", "invoiceCode"], ["Ngay_Tra", "returnedAt"],
      ["Khach_Hang", "customer"], ["Tong_Tien_Hang", "returnSubtotal"], ["Giam_Gia", "discount"],
      ["Phi_Tra_Hang", "returnFee"], ["Can_Tra_Khach", "dueToCustomer"], ["Da_Tra_Khach", "paidToCustomer"],
      ["Can_Tra_Khach_Bang_Chu", "dueToCustomerInWords"], ["Ghi_Chu", "note"]],
    lineFields: LINE,
    template: `${HEADER}
<h2 class="c" style="margin-top:8px">PHIẾU TRẢ HÀNG</h2>
<p class="c">Số: <b>{Ma_Tra_Hang}</b> — {Ngay_Tra} — theo hóa đơn {Ma_Hoa_Don}</p>
<p>Khách hàng: <b>{Khach_Hang}</b></p>
${LINES_TABLE()}
<table style="margin-top:4px">
<tr><td class="r">Tổng tiền hàng trả:</td><td class="r" style="width:30%">{Tong_Tien_Hang}</td></tr>
<tr><td class="r">Phí trả hàng:</td><td class="r">{Phi_Tra_Hang}</td></tr>
<tr><td class="r"><b>Cần trả khách:</b></td><td class="r"><b>{Can_Tra_Khach}</b></td></tr>
<tr><td class="r">Đã trả khách:</td><td class="r">{Da_Tra_Khach}</td></tr>
</table>
${SIGN("Khách hàng", "Người lập phiếu")}`,
  },
  CASH_RECEIPT: {
    label: "Phiếu thu", group: "Sổ quỹ", groupKey: "cashbook",
    fields: [...STORE, ["Ma_Phieu", "voucherCode"], ["Ngay_Tao", "createdAt"], ["Doi_Tuong", "payer"],
      ["SDT_Doi_Tuong", "payerPhone"], ["Loai_Thu_Chi", "receiptReason"], ["So_Tien", "moneyAmount"],
      ["So_Tien_Bang_Chu", "moneyInWords"], ["Quy", "fund"], ["Ghi_Chu", "note"]],
    lineFields: [],
    template: VOUCHER("PHIẾU THU", "người nộp", "Người nộp tiền"),
  },
  CASH_PAYMENT: {
    label: "Phiếu chi", group: "Sổ quỹ", groupKey: "cashbook",
    fields: [...STORE, ["Ma_Phieu", "voucherCode"], ["Ngay_Tao", "createdAt"], ["Doi_Tuong", "payee"],
      ["SDT_Doi_Tuong", "payeePhone"], ["Loai_Thu_Chi", "paymentReason"], ["So_Tien", "moneyAmount"],
      ["So_Tien_Bang_Chu", "moneyInWords"], ["Quy", "fund"], ["Ghi_Chu", "note"]],
    lineFields: [],
    template: VOUCHER("PHIẾU CHI", "người nhận", "Người nhận tiền"),
  },
  PURCHASE_RECEIPT: {
    label: "Nhập hàng", group: "Hàng hóa", groupKey: "products",
    fields: [...STORE, ["Ma_Phieu", "voucherCode"], ["Ngay_Nhap", "receivedAt"], ["Nha_Cung_Cap", "supplier"],
      ["So_HD_Dau_Vao", "inputInvoiceNo"], ["Tong_So_Luong", "totalQuantity"], ["Tong_Tien_Hang", "subtotal"],
      ["Chiet_Khau", "purchaseDiscount"], ["Thue_VAT", "vat"], ["Can_Tra_NCC", "dueToSupplier"], ["Da_Tra_NCC", "paidToSupplier"],
      ["Ghi_Chu", "note"]],
    lineFields: [...LINE, ["Han_Dung", "expiry"]],
    template: `${HEADER}
<h2 class="c" style="margin-top:8px">PHIẾU NHẬP HÀNG</h2>
<p class="c">Mã phiếu: <b>{Ma_Phieu}</b> — {Ngay_Nhap}</p>
<p>Nhà cung cấp: <b>{Nha_Cung_Cap}</b> — Số HĐ: {So_HD_Dau_Vao}</p>
${LINES_TABLE("<th>Lô / HSD</th>", "<td>{So_Lo} {Han_Dung}</td>")}
<table style="margin-top:4px">
<tr><td class="r">Tổng tiền hàng:</td><td class="r" style="width:30%">{Tong_Tien_Hang}</td></tr>
<tr><td class="r">Chiết khấu:</td><td class="r">{Chiet_Khau}</td></tr>
<tr><td class="r">Thuế VAT:</td><td class="r">{Thue_VAT}</td></tr>
<tr><td class="r"><b>Cần trả NCC:</b></td><td class="r"><b>{Can_Tra_NCC}</b></td></tr>
</table>
<p>Ghi chú: {Ghi_Chu}</p>
${SIGN("Nhà cung cấp", "Người lập")}`,
  },
  PURCHASE_RETURN: {
    label: "Trả hàng nhập", group: "Hàng hóa", groupKey: "products",
    fields: [...STORE, ["Ma_Phieu", "voucherCode"], ["Ma_Phieu_Nhap", "receiptCode"], ["Ngay_Tra", "returnedAt"],
      ["Nha_Cung_Cap", "supplier"], ["Tong_Tien_Hang", "returnSubtotal"], ["Giam_Gia", "discount"],
      ["Thue_VAT", "vat"], ["NCC_Can_Tra", "supplierDue"], ["NCC_Da_Tra", "supplierPaid"], ["Ghi_Chu", "note"]],
    lineFields: LINE,
    template: `${HEADER}
<h2 class="c" style="margin-top:8px">PHIẾU TRẢ HÀNG NHẬP</h2>
<p class="c">Mã phiếu: <b>{Ma_Phieu}</b> — {Ngay_Tra} — phiếu nhập {Ma_Phieu_Nhap}</p>
<p>Nhà cung cấp: <b>{Nha_Cung_Cap}</b></p>
${LINES_TABLE("<th>Số lô</th>", "<td>{So_Lo}</td>")}
<table style="margin-top:4px">
<tr><td class="r">Tổng tiền hàng trả:</td><td class="r" style="width:30%">{Tong_Tien_Hang}</td></tr>
<tr><td class="r">Giảm giá:</td><td class="r">{Giam_Gia}</td></tr>
<tr><td class="r">Thuế VAT:</td><td class="r">{Thue_VAT}</td></tr>
<tr><td class="r"><b>NCC cần trả:</b></td><td class="r"><b>{NCC_Can_Tra}</b></td></tr>
</table>
<p>Ghi chú: {Ghi_Chu}</p>
${SIGN("Nhà cung cấp", "Người lập")}`,
  },
};

export const PRINT_TYPES = Object.keys(PRINT_DEFS) as PrintType[];
