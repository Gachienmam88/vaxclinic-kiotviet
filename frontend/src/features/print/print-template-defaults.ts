/** 6 loại mẫu in A5: trường dùng được, dữ liệu mẫu để xem trước, mẫu mặc định. */
export type PrintType = "INVOICE" | "SALES_RETURN" | "CASH_RECEIPT" | "CASH_PAYMENT" | "PURCHASE_RECEIPT" | "PURCHASE_RETURN";

type Def = { label: string; group: string; fields: [string, string][]; lineFields: [string, string][]; template: string };

const STORE: [string, string][] = [
  ["Logo", "Logo cửa hàng"], ["Ten_Cua_Hang", "Tên cửa hàng"], ["Dia_Chi_Cua_Hang", "Địa chỉ cửa hàng"],
  ["Dien_Thoai_Cua_Hang", "Điện thoại cửa hàng"], ["MST_Cua_Hang", "MST cửa hàng"], ["Ten_Chi_Nhanh", "Chi nhánh"],
  ["Ngay", "Ngày in"], ["Thang", "Tháng in"], ["Nam", "Năm in"], ["Nguoi_Tao", "Người tạo"],
];
const LINE: [string, string][] = [
  ["STT", "STT"], ["Ma_Hang", "Mã hàng"], ["Ten_Hang", "Tên hàng"], ["Don_Vi", "Đơn vị"], ["So_Luong", "Số lượng"],
  ["Don_Gia", "Đơn giá"], ["Thanh_Tien", "Thành tiền"], ["So_Lo", "Số lô"],
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

export const PRINT_DEFS: Record<PrintType, Def> = {
  INVOICE: {
    label: "Hóa đơn", group: "Đơn hàng",
    fields: [...STORE, ["Ma_Hoa_Don", "Mã hóa đơn"], ["Ngay_Ban", "Ngày bán"], ["Khach_Hang", "Khách hàng"],
      ["Ma_Khach_Hang", "Mã khách hàng"], ["SDT_Khach_Hang", "SĐT khách hàng"], ["Nguoi_Ban", "Người bán"],
      ["Tong_So_Luong", "Tổng số lượng"], ["Tong_Tien_Hang", "Tổng tiền hàng"], ["Giam_Gia", "Giảm giá hóa đơn"],
      ["Tong_Cong", "Tổng cộng"], ["Tong_Cong_Bang_Chu", "Tổng cộng bằng chữ"], ["Khach_Da_Tra", "Khách đã trả"],
      ["Con_No", "Còn nợ"], ["PT_Thanh_Toan", "Phương thức thanh toán"], ["Ghi_Chu", "Ghi chú"]],
    lineFields: [...LINE, ["Chiet_Khau", "Giảm giá dòng"]],
    template: `${HEADER}
<h2 class="c" style="margin-top:8px">HÓA ĐƠN BÁN HÀNG</h2>
<p class="c">Số: <b>{Ma_Hoa_Don}</b> — {Ngay_Ban}</p>
<p>Khách hàng: <b>{Khach_Hang}</b> — SĐT: {SDT_Khach_Hang}</p>
${LINES_TABLE("<th>Số lô</th>", "<td>{So_Lo}</td>")}
<table style="margin-top:4px">
<tr><td class="r">Tổng tiền hàng:</td><td class="r" style="width:30%">{Tong_Tien_Hang}</td></tr>
<tr><td class="r">Giảm giá:</td><td class="r">{Giam_Gia}</td></tr>
<tr><td class="r"><b>Tổng cộng:</b></td><td class="r"><b>{Tong_Cong}</b></td></tr>
<tr><td class="r">Khách đã trả:</td><td class="r">{Khach_Da_Tra}</td></tr>
<tr><td class="r">Còn nợ:</td><td class="r">{Con_No}</td></tr>
</table>
<p><i>Bằng chữ: {Tong_Cong_Bang_Chu}</i></p>
${SIGN("Khách hàng", "Người bán hàng")}
<p class="c" style="margin-top:8px"><i>Cảm ơn quý khách, hẹn gặp lại!</i></p>`,
  },
  SALES_RETURN: {
    label: "Trả hàng", group: "Đơn hàng",
    fields: [...STORE, ["Ma_Tra_Hang", "Mã trả hàng"], ["Ma_Hoa_Don", "Mã hóa đơn"], ["Ngay_Tra", "Ngày trả"],
      ["Khach_Hang", "Khách hàng"], ["Tong_Tien_Hang", "Tổng tiền hàng trả"], ["Giam_Gia", "Giảm giá"],
      ["Phi_Tra_Hang", "Phí trả hàng"], ["Can_Tra_Khach", "Cần trả khách"], ["Da_Tra_Khach", "Đã trả khách"],
      ["Can_Tra_Khach_Bang_Chu", "Cần trả khách bằng chữ"], ["Ghi_Chu", "Ghi chú"]],
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
    label: "Phiếu thu", group: "Sổ quỹ",
    fields: [...STORE, ["Ma_Phieu", "Mã phiếu"], ["Ngay_Tao", "Ngày tạo"], ["Doi_Tuong", "Người nộp"],
      ["SDT_Doi_Tuong", "SĐT người nộp"], ["Loai_Thu_Chi", "Lý do nộp"], ["So_Tien", "Số tiền"],
      ["So_Tien_Bang_Chu", "Số tiền bằng chữ"], ["Quy", "Hình thức"], ["Ghi_Chu", "Ghi chú"]],
    lineFields: [],
    template: VOUCHER("PHIẾU THU", "người nộp", "Người nộp tiền"),
  },
  CASH_PAYMENT: {
    label: "Phiếu chi", group: "Sổ quỹ",
    fields: [...STORE, ["Ma_Phieu", "Mã phiếu"], ["Ngay_Tao", "Ngày tạo"], ["Doi_Tuong", "Người nhận"],
      ["SDT_Doi_Tuong", "SĐT người nhận"], ["Loai_Thu_Chi", "Lý do chi"], ["So_Tien", "Số tiền"],
      ["So_Tien_Bang_Chu", "Số tiền bằng chữ"], ["Quy", "Hình thức"], ["Ghi_Chu", "Ghi chú"]],
    lineFields: [],
    template: VOUCHER("PHIẾU CHI", "người nhận", "Người nhận tiền"),
  },
  PURCHASE_RECEIPT: {
    label: "Nhập hàng", group: "Hàng hóa",
    fields: [...STORE, ["Ma_Phieu", "Mã phiếu"], ["Ngay_Nhap", "Ngày nhập"], ["Nha_Cung_Cap", "Nhà cung cấp"],
      ["So_HD_Dau_Vao", "Số hóa đơn đầu vào"], ["Tong_So_Luong", "Tổng số lượng"], ["Tong_Tien_Hang", "Tổng tiền hàng"],
      ["Chiet_Khau", "Chiết khấu"], ["Thue_VAT", "Thuế VAT"], ["Can_Tra_NCC", "Cần trả NCC"], ["Da_Tra_NCC", "Đã trả NCC"],
      ["Ghi_Chu", "Ghi chú"]],
    lineFields: [...LINE, ["Han_Dung", "Hạn sử dụng"]],
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
    label: "Trả hàng nhập", group: "Hàng hóa",
    fields: [...STORE, ["Ma_Phieu", "Mã phiếu"], ["Ma_Phieu_Nhap", "Mã phiếu nhập"], ["Ngay_Tra", "Ngày trả"],
      ["Nha_Cung_Cap", "Nhà cung cấp"], ["Tong_Tien_Hang", "Tổng tiền hàng trả"], ["Giam_Gia", "Giảm giá"],
      ["Thue_VAT", "Thuế VAT"], ["NCC_Can_Tra", "NCC cần trả"], ["NCC_Da_Tra", "NCC đã trả"], ["Ghi_Chu", "Ghi chú"]],
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
