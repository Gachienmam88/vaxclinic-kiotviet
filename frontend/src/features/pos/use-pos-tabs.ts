"use client";

import { useEffect, useState } from "react";
import { KEYS, load, newId, save } from "./pos-storage";
import type { CartLine, DraftInvoice } from "./pos-types";

const blank = (n: number, sellerId: string): DraftInvoice => ({
  id: newId(), label: `Hóa đơn ${n}`, mode: "QUICK", customer: null, sellerId, lines: [], discount: 0, paid: null,
  paymentMethod: "CASH", note: "",
});

/** Các tab hóa đơn đang soạn, lưu theo user trên máy (tải lại trang / mất mạng không mất giỏ hàng). */
export function usePosTabs(userId: string) {
  const [tabs, setTabs] = useState<DraftInvoice[]>([]);
  const [activeId, setActiveId] = useState("");
  const [counter, setCounter] = useState(1);

  useEffect(() => {
    if (!userId) return;
    const saved = load<{ tabs: DraftInvoice[]; activeId: string; counter: number } | null>(KEYS.tabs(userId), null);
    if (saved?.tabs.length) {
      setTabs(saved.tabs);
      setActiveId(saved.activeId);
      setCounter(saved.counter);
    } else {
      const first = blank(1, userId);
      setTabs([first]);
      setActiveId(first.id);
      setCounter(2);
    }
  }, [userId]);

  useEffect(() => {
    if (userId && tabs.length) save(KEYS.tabs(userId), { tabs, activeId, counter });
  }, [userId, tabs, activeId, counter]);

  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];

  const update = (patch: Partial<DraftInvoice>) =>
    setTabs((all) => all.map((t) => (t.id === active?.id ? { ...t, ...patch } : t)));

  const setLines = (fn: (lines: CartLine[]) => CartLine[]) =>
    setTabs((all) => all.map((t) => (t.id === active?.id ? { ...t, lines: fn(t.lines) } : t)));

  const add = () => {
    const t = blank(counter, userId);
    setTabs((all) => [...all, t]);
    setActiveId(t.id);
    setCounter((c) => c + 1);
  };

  /** Đóng tab; nếu là tab cuối thì thay bằng hóa đơn trống mới (luôn còn ít nhất 1 tab). */
  const close = (id: string) => {
    setTabs((all) => {
      const rest = all.filter((t) => t.id !== id);
      if (rest.length) {
        if (id === activeId) setActiveId(rest[rest.length - 1].id);
        return rest;
      }
      const t = blank(counter, userId);
      setActiveId(t.id);
      setCounter((c) => c + 1);
      return [t];
    });
  };

  /** Sau khi thanh toán: tab đó trở thành hóa đơn trống mới (id mới). */
  const resetActive = () => {
    const t = { ...blank(counter, userId), mode: active?.mode ?? "QUICK" };
    setTabs((all) => all.map((x) => (x.id === active?.id ? t : x)));
    setActiveId(t.id);
    setCounter((c) => c + 1);
  };

  return { tabs, active, setActiveId, update, setLines, add, close, resetActive };
}

/** Tạm tính giống InvoiceMath (backend): làm tròn từng dòng, giảm giá HĐ không vượt tổng. */
export function cartTotals(t: DraftInvoice) {
  const subtotal = t.lines.reduce((s, l) => s + Math.round(l.quantity * (l.unitPrice - l.discount)), 0);
  const discount = Math.min(Math.round(t.discount), subtotal);
  const total = subtotal - discount;
  const quantity = t.lines.reduce((s, l) => s + l.quantity, 0);
  return { subtotal, discount, total, quantity, paid: t.paid ?? total };
}
