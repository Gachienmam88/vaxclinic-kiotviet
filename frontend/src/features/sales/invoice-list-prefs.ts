"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Tùy chọn danh sách Hóa đơn lưu theo từng người dùng trên máy này (localStorage, khóa theo user id):
 * hóa đơn đánh dấu sao ☆ và các cột đang hiển thị. Chưa đồng bộ giữa các máy.
 */
function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Trình duyệt chặn lưu trữ: vẫn dùng được trong phiên hiện tại
  }
}

function useUserPref<T>(name: string, userId: string | undefined, fallback: T) {
  const key = userId ? `kv.invoices.${name}.${userId}` : null;
  const [value, setValue] = useState<T>(fallback);
  // Đọc lại khi biết user (lần đầu render chưa có /auth/me)
  useEffect(() => { if (key) setValue(read(key, fallback)); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const update = useCallback((next: T) => { setValue(next); if (key) write(key, next); }, [key]);
  return [value, update] as const;
}

export function useInvoiceFavourites(userId: string | undefined) {
  const [ids, setIds] = useUserPref<string[]>("favourites", userId, []);
  const toggle = (id: string) => setIds(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
  return { ids, isFav: (id: string) => ids.includes(id), toggle };
}

/**
 * Cột có thể ẩn / hiện (Mã hóa đơn luôn hiện), đúng thứ tự KiotViet. Chỉ gồm cột hệ thống có dữ liệu — bỏ Trạng thái / Ghi chú
 * CSDL về dược, Mã đối soát, Bác sĩ, VAT, Giảm thuế, Tổng tiền hàng sau thuế, Chiết khấu thanh toán, Tên nhà cung cấp.
 * Nhãn hiển thị: salesNs "invoices.columns.<khóa>".
 */
export const INVOICE_COLUMNS = [
  ["shipmentCode", "Mã vận đơn"], ["shipmentStatus", "Trạng thái giao hàng"], ["soldAt", "Thời gian"], ["createdAt", "Thời gian tạo"],
  ["updatedAt", "Ngày cập nhật"], ["orderCode", "Mã đặt hàng"], ["returnCodes", "Mã trả hàng"], ["customerCode", "Mã KH"],
  ["customerName", "Khách hàng"], ["customerEmail", "Email"], ["customerPhone", "Điện thoại"], ["customerAddress", "Địa chỉ"],
  ["customerProvince", "Khu vực"], ["customerWard", "Phường/Xã"], ["customerBirthday", "Ngày sinh"], ["branch", "Chi nhánh"],
  ["sellerTaxCode", "Mã số thuế người bán"], ["sellerName", "Người bán"], ["createdByName", "Người tạo"],
  ["salesChannelName", "Kênh bán"], ["deliveryPartnerName", "Đối tác giao hàng"], ["note", "Ghi chú"], ["subtotal", "Tổng tiền hàng"],
  ["discount", "Giảm giá"], ["total", "Khách cần trả"], ["paid", "Khách đã trả"], ["cod", "Còn cần thu (COD)"],
  ["partnerFee", "Phí trả ĐTGH"], ["deliveryTime", "Thời gian giao hàng"], ["state", "Trạng thái"], ["einvoice", "Trạng thái HĐĐT"],
  ["einvoiceNature", "Tính chất hóa đơn"], ["einvoiceNo", "Số hóa đơn"], ["einvoiceSeries", "Ký hiệu hóa đơn"],
] as const;

export type InvoiceColumn = (typeof INVOICE_COLUMNS)[number][0];

/** Cột cần bản ghi HĐĐT (integration-service) của các hóa đơn đang hiển thị. */
export const EINVOICE_COLUMNS: InvoiceColumn[] = ["einvoice", "einvoiceNature", "einvoiceNo", "einvoiceSeries"];

const DEFAULT_COLUMNS: InvoiceColumn[] = ["soldAt", "returnCodes", "customerCode", "customerName", "subtotal", "discount", "total", "paid", "einvoice"];

export function useInvoiceColumns(userId: string | undefined) {
  const [saved, setCols] = useUserPref<InvoiceColumn[]>("columns", userId, DEFAULT_COLUMNS);
  const cols = saved.filter((c) => INVOICE_COLUMNS.some(([k]) => k === c)); // bỏ cột cũ đã ngừng dùng
  const toggle = (c: InvoiceColumn, on: boolean) => setCols(on ? INVOICE_COLUMNS.map(([k]) => k).filter((k) => k === c || cols.includes(k))
    : cols.filter((k) => k !== c));
  return { cols, shown: (c: InvoiceColumn) => cols.includes(c), toggle };
}
