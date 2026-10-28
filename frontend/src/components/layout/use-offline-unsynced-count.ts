"use client";

import { useEffect, useState } from "react";
import { KEYS, load } from "@/features/sale/sale-storage";

/** Khóa hàng đợi phiếu bán offline lấy từ màn bán hàng (một nguồn duy nhất; load() tự chuyển khóa cũ sang khóa mới). */
const OFFLINE_QUEUE_KEY = KEYS.queue;

function readCount(): number {
  const v = load<unknown>(OFFLINE_QUEUE_KEY, []); // trình duyệt chặn bộ nhớ / dữ liệu hỏng → []
  return Array.isArray(v) ? v.length : 0;
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
