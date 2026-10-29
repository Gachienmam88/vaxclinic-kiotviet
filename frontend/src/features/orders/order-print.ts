import QRCode from "qrcode";
import { amountInWords, type PrintData } from "@/features/print/print-render";
import type { BankAccount } from "@/features/sales/sales-types";
import { api } from "@/lib/api-client";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import type { Order } from "./order-types";

/** Trường in "Hóa đơn đặt hàng" (mẫu ORDER). Còn cần trả = khách cần trả − đã đặt cọc. */
export function orderPrintData(o: Order, qr = ""): PrintData {
  const remaining = Math.max(0, Number(o.total) - Number(o.deposit));
  return {
    Ma_Dat_Hang: o.code, Ngay_Dat: formatDateTime(o.orderedAt), Khach_Hang: o.customerName, Ma_Khach_Hang: o.customerCode ?? "",
    SDT_Khach_Hang: o.customerPhone ?? "", Nguoi_Ban: o.sellerName ?? "", Nguoi_Tao: o.createdByName,
    Tong_So_Luong: formatNumber(o.lines.reduce((s, l) => s + Number(l.quantity), 0)), Tong_Tien_Hang: formatMoney(o.subtotal),
    Giam_Gia: formatMoney(o.discount), Tong_Cong: formatMoney(o.total), Tong_Cong_Bang_Chu: amountInWords(Number(o.total)),
    Khach_Da_Tra: formatMoney(o.deposit), Con_No: formatMoney(remaining), QR_Thanh_Toan: qr, Ghi_Chu: o.note ?? "",
    __lines: o.lines.map((l, i) => ({
      STT: String(i + 1), Ma_Hang: l.productCode, Ten_Hang: l.productName, Don_Vi: l.unitName, So_Luong: formatNumber(l.quantity),
      Don_Gia: formatMoney(l.unitPrice), Chiet_Khau: formatMoney(l.discount), Thanh_Tien: formatMoney(l.amount), So_Lo: "",
    })),
  };
}

/**
 * QR VietQR chuyển khoản phần khách còn cần trả, theo tài khoản ngân hàng đầu tiên của cửa hàng (nội dung = mã đơn).
 * Không có tài khoản ngân hàng / đã trả đủ / lỗi → "" (mẫu in bỏ trống ô QR).
 */
export async function orderPaymentQr(o: Order): Promise<string> {
  const remaining = Math.round(Math.max(0, Number(o.total) - Number(o.deposit)));
  if (remaining <= 0) return "";
  try {
    const bank = (await api<BankAccount[]>("/bank-accounts")).find((b) => (b.kind ?? "BANK") === "BANK" && b.bankBin);
    if (!bank) return "";
    const q = await api<{ payload: string }>(`/bank-accounts/${bank.id}/vietqr?amount=${remaining}&info=${encodeURIComponent(o.code)}`);
    return await QRCode.toDataURL(q.payload, { width: 220, margin: 1, errorCorrectionLevel: "M" });
  } catch {
    return "";
  }
}
