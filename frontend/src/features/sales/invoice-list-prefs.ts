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

/** Cột có thể ẩn / hiện (Mã hóa đơn luôn hiện). */
export const INVOICE_COLUMNS = [
  ["soldAt", "Thời gian"], ["returnCodes", "Mã trả hàng"], ["customerCode", "Mã KH"], ["customerName", "Khách hàng"],
  ["sellerName", "Người bán"], ["subtotal", "Tổng tiền hàng"], ["discount", "Giảm giá"], ["total", "Khách cần trả"],
  ["paid", "Khách đã trả"], ["paymentMethod", "Thanh toán"], ["state", "Trạng thái"],
] as const;

export type InvoiceColumn = (typeof INVOICE_COLUMNS)[number][0];

const DEFAULT_COLUMNS: InvoiceColumn[] = ["soldAt", "returnCodes", "customerCode", "customerName", "subtotal", "discount", "total", "paid"];

export function useInvoiceColumns(userId: string | undefined) {
  const [cols, setCols] = useUserPref<InvoiceColumn[]>("columns", userId, DEFAULT_COLUMNS);
  const toggle = (c: InvoiceColumn, on: boolean) => setCols(on ? INVOICE_COLUMNS.map(([k]) => k).filter((k) => k === c || cols.includes(k))
    : cols.filter((k) => k !== c));
  return { cols, shown: (c: InvoiceColumn) => cols.includes(c), toggle };
}
