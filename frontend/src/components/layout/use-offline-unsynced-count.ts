"use client";

import { useEffect, useState } from "react";
import { KEYS, load } from "@/features/pos/pos-storage";

/**
 * Số phiếu bán offline chưa đồng bộ trên máy này (hàng đợi của màn bán hàng, chỉ nằm trong trình duyệt) — hiện thành
 * một dòng cảnh báo cục bộ trong Hộp thư đến. Đọc lại khi tab khác đổi hàng đợi (sự kiện storage) và mỗi 30 giây.
 */
export function useOfflineUnsyncedCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const read = () => setCount(load<unknown[]>(KEYS.queue, []).length);
    read();
    const onStorage = (e: StorageEvent) => { if (e.key === null || e.key === KEYS.queue) read(); };
    window.addEventListener("storage", onStorage);
    const t = setInterval(read, 30_000);
    return () => { window.removeEventListener("storage", onStorage); clearInterval(t); };
  }, []);
  return count;
}
