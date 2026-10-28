"use client";

import { useEffect, useState } from "react";
import { migrateDraft } from "./sale-price-book-pricing";
import { KEYS, load, newId, save } from "./sale-storage";
import type { CartLine, DraftInvoice } from "./sale-types";

/** Mặc định tab mới theo Thiết lập → Thanh toán (phương thức mặc định; "Tiền khách thanh toán bằng khách cần trả"). */
export type TabDefaults = { paymentMethod: DraftInvoice["paymentMethod"]; paidEqualsDue: boolean };
const NO_DEFAULTS: TabDefaults = { paymentMethod: "CASH", paidEqualsDue: true };

const blank = (n: number, sellerId: string, def: TabDefaults = NO_DEFAULTS): DraftInvoice => ({
  id: newId(), label: `Hóa đơn ${n}`, mode: "QUICK", customer: null, sellerId, lines: [], discount: 0,
  paid: def.paidEqualsDue ? null : 0, paymentMethod: def.paymentMethod, note: "", priceBookId: null, salesChannel: "DIRECT",
});

const blankOrder = (n: number, sellerId: string, def?: TabDefaults): DraftInvoice =>
  ({ ...blank(n, sellerId, def), kind: "ORDER", label: `Đặt hàng ${n}`, paid: null });

/** Trả nhanh: phiếu trả không theo hóa đơn — hàng trả thêm như giỏ hàng (giá trả sửa được). */
const blankQuickReturn = (n: number, sellerId: string): DraftInvoice =>
  ({ ...blank(n, sellerId), kind: "RETURN", label: `Trả hàng ${n}`, quickReturn: { fee: 0, refund: null } });

/** Các tab hóa đơn đang soạn, lưu theo user trên máy (tải lại trang / mất mạng không mất giỏ hàng). */
export function useSaleTabs(userId: string, def: TabDefaults = NO_DEFAULTS) {
  const [tabs, setTabs] = useState<DraftInvoice[]>([]);
  const [activeId, setActiveId] = useState("");
  const [counter, setCounter] = useState(1);

  useEffect(() => {
    if (!userId) return;
    const saved = load<{ tabs: DraftInvoice[]; activeId: string; counter: number } | null>(KEYS.tabs(userId), null);
    if (saved?.tabs.length) {
      setTabs(saved.tabs.map(migrateDraft));
      setActiveId(saved.activeId);
      setCounter(saved.counter);
    } else {
      const first = blank(1, userId, def);
      setTabs([first]);
      setActiveId(first.id);
      setCounter(2);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ đọc tab đã lưu 1 lần theo user; đổi thiết lập không dựng lại tab
  }, [userId]);

  useEffect(() => {
    if (userId && tabs.length) save(KEYS.tabs(userId), { tabs, activeId, counter });
  }, [userId, tabs, activeId, counter]);

  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];

  const update = (patch: Partial<DraftInvoice>) =>
    setTabs((all) => all.map((t) => (t.id === active?.id ? { ...t, ...patch } : t)));

  const setLines = (fn: (lines: CartLine[]) => CartLine[]) =>
    setTabs((all) => all.map((t) => (t.id === active?.id ? { ...t, lines: fn(t.lines) } : t)));

  const add = (kind?: "ORDER" | "QUICK_RETURN") => {
    const t = kind === "ORDER" ? blankOrder(counter, userId, def) : kind === "QUICK_RETURN" ? blankQuickReturn(counter, userId)
      : blank(counter, userId, def);
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
      const t = blank(counter, userId, def);
      setActiveId(t.id);
      setCounter((c) => c + 1);
      return [t];
    });
  };

  /** Sau khi thanh toán / đặt hàng: tab đó trở thành tab trống mới cùng loại (id mới). */
  const resetActive = () => {
    const fresh = active?.kind === "ORDER" && !active.orderOf ? blankOrder(counter, userId, def)
      : active?.quickReturn ? blankQuickReturn(counter, userId) : blank(counter, userId, def);
    const t = { ...fresh, mode: active?.mode ?? "QUICK" };
    setTabs((all) => all.map((x) => (x.id === active?.id ? t : x)));
    setActiveId(t.id);
    setCounter((c) => c + 1);
  };

  /** Mở tab sửa / trả hàng (đã mở rồi thì chuyển sang tab đó). */
  const open = (d: DraftInvoice) => {
    setTabs((all) => {
      const same = all.find((t) => (d.editOf && t.editOf?.invoiceId === d.editOf.invoiceId)
        || (d.returnOf && t.returnOf?.invoiceId === d.returnOf.invoiceId)
        || (d.orderOf && t.orderOf?.orderId === d.orderOf.orderId) || (d.fromOrder && t.fromOrder?.orderId === d.fromOrder.orderId));
      if (same) {
        setActiveId(same.id);
        return all;
      }
      setActiveId(d.id);
      return [...all, d];
    });
  };

  /** Thêm nhiều tab một lần (Import file: mỗi trang tính 1 hóa đơn); tab cuối được chọn. */
  const openMany = (make: (label: string, i: number) => DraftInvoice, count: number) => {
    const made = Array.from({ length: count }, (_, i) => make(`Hóa đơn ${counter + i}`, i));
    if (!made.length) return [];
    setTabs((all) => [...all, ...made]);
    setActiveId(made[made.length - 1].id);
    setCounter((c) => c + count);
    return made;
  };

  /** Tab trống mặc định (để import dựng tab mới). */
  const blankTab = (label: string) => ({ ...blank(0, userId, def), label });

  return { tabs, active, setActiveId, update, setLines, add, close, resetActive, open, openMany, blankTab };
}

/**
 * Tạm tính giống InvoiceMath (backend): làm tròn từng dòng, giảm giá HĐ không vượt tổng.
 * deposit = tiền khách đã trả trước cho đơn đặt hàng; due = còn phải trả. Mặc định "Khách thanh toán":
 * hóa đơn = trả đủ phần còn lại; đặt hàng = 0 (khách chưa đặt cọc).
 */
export function cartTotals(t: DraftInvoice) {
  const subtotal = t.lines.reduce((s, l) => s + Math.round(l.quantity * (l.unitPrice - l.discount)), 0);
  const raw = t.discountPercent != null ? (subtotal * t.discountPercent) / 100 : t.discount;
  const discount = Math.min(Math.round(raw), subtotal);
  const total = subtotal - discount;
  const quantity = t.lines.reduce((s, l) => s + l.quantity, 0);
  const deposit = (t.orderOf ?? t.fromOrder)?.deposit ?? 0;
  const due = Math.max(0, total - deposit);
  // Bán giao hàng: mặc định khách chưa trả → toàn bộ là tiền thu hộ (COD)
  const paid = t.paid ?? (t.kind === "ORDER" || (t.mode === "DELIVERY" && !t.editOf) ? 0 : due);
  return { subtotal, discount, total, quantity, deposit, due, paid, cod: t.mode === "DELIVERY" && t.kind !== "ORDER" ? Math.max(0, due - paid) : 0 };
}

export type SaleTabs = ReturnType<typeof useSaleTabs>;
