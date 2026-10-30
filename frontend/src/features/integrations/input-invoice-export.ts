import { downloadXlsx } from "@/features/delivery/delivery-xlsx";
import { api } from "@/lib/api-client";
import { linkOf, NATURE_LABEL, type InputInvoice } from "./integration-queries";

const LINK_LABEL = { RECEIPT: "Phiếu nhập", SUPPLIER_PAYMENT: "Phiếu chi NCC", CASH_VOUCHER: "Phiếu chi" } as const;

/**
 * "Xuất file" hóa đơn đầu vào (.xlsx): MỌI hóa đơn khớp bộ lọc (GET /input-invoices/export, tối đa 5.000), không chỉ trang
 * đang xem. Dữ liệu thuế → tiêu đề / giá trị giữ tiếng Việt ở mọi ngôn ngữ; ô bắt đầu = + - @ được chặn công thức.
 */
export async function exportInputInvoicesXlsx(params: URLSearchParams) {
  const p = new URLSearchParams(params);
  p.delete("page");
  p.delete("size");
  const items = await api<InputInvoice[]>(`/input-invoices/export?${p}`);
  const header = ["Ký hiệu", "Số hóa đơn", "Ngày hóa đơn", "Nhà cung cấp", "MST người bán", "Mã số thuế", "Tổng tiền chưa thuế",
    "Tiền thuế", "Tổng tiền", "Trạng thái lập phiếu", "Chứng từ", "Tính chất"];
  const rows = items.map((i) => {
    const link = linkOf(i);
    const [y, m, d] = i.issuedAt.slice(0, 10).split("-");
    return [`${i.templateNo ?? ""}${i.series}`, i.number, `${d}/${m}/${y}`, i.sellerName, i.sellerTaxCode, i.buyerTaxCode,
      i.totalBeforeTax == null ? null : Number(i.totalBeforeTax), i.vatAmount == null ? null : Number(i.vatAmount), Number(i.total),
      link.id ? "Đã lập phiếu" : "Chưa lập phiếu",
      link.code ? `${i.linkType ? LINK_LABEL[i.linkType] : "Phiếu nhập"} ${link.code}` : "", NATURE_LABEL[i.nature]];
  });
  await downloadXlsx("DanhSachHoaDonDauVao", header, rows,
    [false, false, false, false, false, false, true, true, true, false, false, false]);
  return items.length;
}
