"use client";

import { useEffect, useState } from "react";

/**
 * Khóa localStorage của hàng đợi phiếu bán offline (màn bán hàng): mảng phiếu chưa gửi được lên server.
 * Màn bán hàng đổi tên khóa thì sửa cả ở đây.
 */
export const OFFLINE_QUEUE_KEY = "pos.queue";

function readCount(): number {
  try {
    const raw = window.localStorage.getItem(OFFLINE_QUEUE_KEY);
    const v: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v.length : 0;
  } catch {
    return 0; // trình duyệt chặn bộ nhớ / dữ liệu hỏng → coi như không có
  }
}

/**
 * Số phiếu bán offline chưa đồng bộ trên máy này (chỉ nằm trong trình duyệt) — hiện thành một dòng cảnh báo cục bộ
 * trong Hộp thư đến. Đọc lại khi tab khác đổi hàng đợi (sự kiện storage) và mỗi 30 giây.
 */
export function useOfflineUnsyncedCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const read = () => setCount(readCount());
    read();
    const onStorage = (e: StorageEvent) => { if (e.key === null || e.key === OFFLINE_QUEUE_KEY) read(); };
    window.addEventListener("storage", onStorage);
    const t = setInterval(read, 30_000);
    return () => { window.removeEventListener("storage", onStorage); clearInterval(t); };
  }, []);
  return count;
}
