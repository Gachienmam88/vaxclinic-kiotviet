"use client";

import { useQuery } from "@tanstack/react-query";
import type { StoreInfo } from "@/features/settings/settings-queries";
import type { PurchaseReturn, Receipt } from "@/features/purchases/purchase-types";
import type { Invoice } from "@/features/sales/sales-types";
import { FUND_LABEL, methodLabel } from "@/features/sales/sales-types";
import { api } from "@/lib/api-client";
import { formatDate, formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { joinAddress } from "@/lib/vn-admin-search";
import { amountInWords, type PrintData } from "./print-render";
import type { PrintType } from "./print-template-defaults";

/** Mẫu đã sửa của cửa hàng (loại không có → dùng mặc định). */
export function usePrintTemplates() {
  return useQuery({ queryKey: ["print-templates"], queryFn: () => api<Partial<Record<PrintType, string>>>("/print-templates"), staleTime: 5 * 60_000 });
}

type Line = { productCode?: string; productName: string; unitName: string; quantity: number; unitPrice: number; amount: number;
  discount?: number; lots?: string | null; lotNumber?: string | null; expiryDate?: string | null };

const lines = (ls: Line[]) => ls.map((l, i) => ({
  STT: String(i + 1), Ma_Hang: l.productCode ?? "", Ten_Hang: l.productName, Don_Vi: l.unitName,
  So_Luong: formatNumber(l.quantity), Don_Gia: formatMoney(l.unitPrice), Thanh_Tien: formatMoney(l.amount),
  Chiet_Khau: formatMoney(l.discount ?? 0), So_Lo: l.lots ?? l.lotNumber ?? "", Han_Dung: formatDate(l.expiryDate ?? null),
}));

/** Trường chung: cửa hàng + ngày in. */
export function storeFields(store: StoreInfo | null, branchName = "", createdBy = ""): PrintData {
  const now = new Date();
  return {
    Logo: store?.logo ?? "", Ten_Cua_Hang: store?.name ?? "", Dien_Thoai_Cua_Hang: store?.phone ?? "",
    Dia_Chi_Cua_Hang: joinAddress(store?.address, store?.ward, store?.province),
    MST_Cua_Hang: store?.taxCode ?? "", Ten_Chi_Nhanh: branchName, Nguoi_Tao: createdBy,
    Ngay: String(now.getDate()).padStart(2, "0"), Thang: String(now.getMonth() + 1).padStart(2, "0"), Nam: String(now.getFullYear()),
  };
}

export function invoiceData(inv: Invoice): PrintData {
  return {
    Ma_Hoa_Don: inv.code, Ngay_Ban: formatDateTime(inv.soldAt), Khach_Hang: inv.customerName, Ma_Khach_Hang: inv.customerCode ?? "",
    SDT_Khach_Hang: inv.customerPhone ?? "", Dia_Chi_Khach_Hang: inv.customerAddress ?? "",
    Dia_Chi_Giao_Hang: inv.shipment ? joinAddress(inv.shipment.receiverAddress, inv.shipment.area) : "", Nguoi_Ban: inv.sellerName ?? "", Nguoi_Tao: inv.createdByName,
    Tong_So_Luong: formatNumber(inv.lines.reduce((s, l) => s + Number(l.quantity), 0)),
    Tong_Tien_Hang: formatMoney(inv.subtotal), Giam_Gia: formatMoney(inv.discount), Tong_Cong: formatMoney(inv.total),
    Tong_Cong_Bang_Chu: amountInWords(Number(inv.total)), Khach_Da_Tra: formatMoney(inv.paid),
    Con_No: formatMoney(Number(inv.total) - Number(inv.paid)), PT_Thanh_Toan: methodLabel(inv.paymentMethod), Ghi_Chu: inv.note ?? "",
    __lines: lines(inv.lines),
  };
}

export type SalesReturnDoc = { code: string; returnedAt: string; invoiceCode: string; customerName: string; createdByName: string;
  subtotal: number; discount: number; fee: number; total: number; refunded: number; note: string | null; lines: Line[] };

export function salesReturnData(r: SalesReturnDoc): PrintData {
  return {
    Ma_Tra_Hang: r.code, Ma_Hoa_Don: r.invoiceCode, Ngay_Tra: formatDateTime(r.returnedAt), Khach_Hang: r.customerName,
    Nguoi_Tao: r.createdByName, Tong_Tien_Hang: formatMoney(r.subtotal), Giam_Gia: formatMoney(r.discount),
    Phi_Tra_Hang: formatMoney(r.fee), Can_Tra_Khach: formatMoney(r.total), Da_Tra_Khach: formatMoney(r.refunded),
    Can_Tra_Khach_Bang_Chu: amountInWords(Number(r.total)), Ghi_Chu: r.note ?? "", __lines: lines(r.lines),
  };
}

export type VoucherDoc = { code: string; voucherType: string; occurredAt: string; partnerName: string | null; partnerPhone: string | null;
  category: string; amount: number; fund: string; note: string | null; createdByName: string | null };

export function voucherData(v: VoucherDoc): PrintData {
  return {
    Ma_Phieu: v.code, Ngay_Tao: formatDateTime(v.occurredAt), Doi_Tuong: v.partnerName ?? "", SDT_Doi_Tuong: v.partnerPhone ?? "",
    Loai_Thu_Chi: v.category, So_Tien: formatMoney(v.amount), So_Tien_Bang_Chu: amountInWords(Number(v.amount)),
    Quy: FUND_LABEL[v.fund] ?? v.fund, Ghi_Chu: v.note ?? "", Nguoi_Tao: v.createdByName ?? "",
  };
}

export function receiptData(r: Receipt): PrintData {
  return {
    Ma_Phieu: r.code, Ngay_Nhap: formatDateTime(r.receivedAt), Nha_Cung_Cap: r.supplierName ?? "", So_HD_Dau_Vao: r.inputInvoiceNo ?? "",
    Nguoi_Tao: r.createdByName, Tong_So_Luong: formatNumber(r.lines.reduce((s, l) => s + Number(l.quantity), 0)),
    Tong_Tien_Hang: formatMoney(r.subtotal), Chiet_Khau: formatMoney(r.discount), Thue_VAT: formatMoney(r.vatAmount),
    Can_Tra_NCC: formatMoney(r.total), Da_Tra_NCC: formatMoney(r.paidAmount), Ghi_Chu: r.note ?? "", __lines: lines(r.lines),
  };
}

export function purchaseReturnData(r: PurchaseReturn): PrintData {
  return {
    Ma_Phieu: r.code, Ma_Phieu_Nhap: r.receiptCode ?? "", Ngay_Tra: formatDateTime(r.returnedAt), Nha_Cung_Cap: r.supplierName ?? "",
    Nguoi_Tao: r.createdByName, Tong_Tien_Hang: formatMoney(r.subtotal), Giam_Gia: formatMoney(r.discount),
    Thue_VAT: formatMoney(r.vatAmount), NCC_Can_Tra: formatMoney(r.total), NCC_Da_Tra: formatMoney(r.refundAmount),
    Ghi_Chu: r.note ?? "", __lines: lines(r.lines),
  };
}

/** Dữ liệu mẫu để xem trước khi sửa mẫu in. */
export function sampleData(type: PrintType): PrintData {
  const sampleLines: Line[] = [
    { productCode: "SP000001", productName: "Vắc xin Rotateq", unitName: "Liều", quantity: 1, unitPrice: 665000, amount: 665000, lots: "RT2601" },
    { productCode: "SP000002", productName: "Vắc xin Hexaxim", unitName: "Liều", quantity: 2, unitPrice: 1015000, amount: 2030000, lots: "HX2512" },
  ];
  const voucher = (t: string): VoucherDoc => ({ code: t === "RECEIPT" ? "PT000123" : "PC000045", voucherType: t, occurredAt: new Date().toISOString(),
    partnerName: "Nguyễn Văn An", partnerPhone: "0987654321", category: t === "RECEIPT" ? "Thu tiền khách trả" : "Chi phí khác",
    amount: 1500000, fund: "CASH", note: "", createdByName: "Thu ngân" });
  switch (type) {
    case "INVOICE":
      return invoiceData({ code: "HD000123", soldAt: new Date().toISOString(), customerName: "Nguyễn Văn An", customerCode: "KH000001",
        customerPhone: "0987654321", customerAddress: "12 Lê Lợi, Phường Bến Thành, Thành phố Hồ Chí Minh",
        sellerName: "Thu ngân", createdByName: "Thu ngân", subtotal: 2695000, discount: 0, total: 2695000,
        paid: 2695000, paymentMethod: "CASH", note: "", lines: sampleLines } as unknown as Invoice);
    case "SALES_RETURN":
      return salesReturnData({ code: "TH000012", returnedAt: new Date().toISOString(), invoiceCode: "HD000123", customerName: "Nguyễn Văn An",
        createdByName: "Thu ngân", subtotal: 665000, discount: 0, fee: 0, total: 665000, refunded: 665000, note: "", lines: sampleLines.slice(0, 1) });
    case "CASH_RECEIPT": return voucherData(voucher("RECEIPT"));
    case "CASH_PAYMENT": return voucherData(voucher("PAYMENT"));
    case "PURCHASE_RECEIPT":
      return receiptData({ code: "PN000034", receivedAt: new Date().toISOString(), supplierName: "Công ty CP Vắc xin Việt Nam", inputInvoiceNo: "712",
        createdByName: "Thủ kho", subtotal: 20000000, discount: 0, vatAmount: 1000000, total: 21000000, paidAmount: 21000000, note: "",
        lines: sampleLines.map((l) => ({ ...l, lotNumber: l.lots, expiryDate: "2027-06-30" })) } as unknown as Receipt);
    case "PURCHASE_RETURN":
      return purchaseReturnData({ code: "THN000003", receiptCode: "PN000034", returnedAt: new Date().toISOString(), supplierName: "Công ty CP Vắc xin Việt Nam",
        createdByName: "Thủ kho", subtotal: 665000, discount: 0, vatAmount: 33250, total: 698250, refundAmount: 698250, note: "",
        lines: sampleLines.slice(0, 1).map((l) => ({ ...l, lotNumber: l.lots })) } as unknown as PurchaseReturn);
  }
}
