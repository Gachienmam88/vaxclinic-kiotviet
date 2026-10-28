"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import { isNetworkError, KEYS, load, save } from "./pos-storage";
import type { QueuedInvoice } from "./pos-types";

/**
 * Hàng đợi hóa đơn offline. Đồng bộ khi có mạng lại (sự kiện "online") và mỗi 15 giây.
 * - Gửi thành công → xóa khỏi hàng đợi (server bỏ qua nếu đã nhận: cùng id = cùng hóa đơn).
 * - Lỗi nghiệp vụ (VD hết lô còn hạn) → đánh dấu "error" + lý do, GIỮ LẠI để nhân viên xử lý, không tự xóa.
 * - Lỗi mạng → dừng, thử lại lần sau.
 */
export function useOfflineQueue(onSynced?: (code: string, item: QueuedInvoice) => void) {
  const [queue, setQueue] = useState<QueuedInvoice[]>([]);
  const syncing = useRef(false);

  const persist = useCallback((next: QueuedInvoice[]) => {
    setQueue(next);
    save(KEYS.queue, next);
  }, []);

  useEffect(() => setQueue(load<QueuedInvoice[]>(KEYS.queue, [])), []);

  const sync = useCallback(async () => {
    if (syncing.current) return;
    syncing.current = true;
    try {
      let current = load<QueuedInvoice[]>(KEYS.queue, []);
      for (const item of current.filter((q) => q.status === "pending")) {
        try {
          const inv = await api<{ code: string }>("/invoices", { method: "POST", body: item.body });
          current = current.filter((q) => q.id !== item.id);
          persist(current);
          onSynced?.(inv.code, item);
        } catch (e) {
          if (isNetworkError(e)) break;
          current = current.map((q) => (q.id === item.id ? { ...q, status: "error" as const, error: (e as Error).message } : q));
          persist(current);
        }
      }
    } finally {
      syncing.current = false;
    }
  }, [persist, onSynced]);

  useEffect(() => {
    window.addEventListener("online", sync);
    const t = setInterval(sync, 15_000);
    return () => { window.removeEventListener("online", sync); clearInterval(t); };
  }, [sync]);

  const enqueue = (item: QueuedInvoice) => persist([...load<QueuedInvoice[]>(KEYS.queue, []), item]);
  const retry = (id: string) => {
    persist(load<QueuedInvoice[]>(KEYS.queue, []).map((q) => (q.id === id ? { ...q, status: "pending" as const, error: undefined } : q)));
    void sync();
  };
  const remove = (id: string) => persist(load<QueuedInvoice[]>(KEYS.queue, []).filter((q) => q.id !== id));

  return { queue, enqueue, retry, remove, sync };
}
