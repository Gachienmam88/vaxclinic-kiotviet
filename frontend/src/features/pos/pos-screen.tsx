"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { CloudOff, LayoutGrid, Plus, Undo2, Wifi, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { formatMoney } from "@/lib/format";
import { useCurrentUser } from "@/lib/use-current-user";
import { useUserLookup } from "@/features/purchases/purchase-queries";
import { SALES_KEYS } from "@/features/sales/sales-queries";
import { PosCart } from "./pos-cart";
import { PosCheckoutPanel } from "./pos-checkout-panel";
import { PosProductGrid } from "./pos-product-grid";
import { PosProductSearch } from "./pos-product-search";
import { PosQueueDialog } from "./pos-queue-dialog";
import { isNetworkError, newId } from "./pos-storage";
import { useOfflineQueue } from "./use-offline-queue";
import { usePosCatalog } from "./use-pos-catalog";
import { cartTotals, usePosTabs } from "./use-pos-tabs";
import type { CatalogProduct, DraftInvoice } from "./pos-types";

function toBody(d: DraftInvoice, branchId: string, sellerName: string | undefined, offline: boolean) {
  const t = cartTotals(d);
  return {
    id: d.id, branchId, customerId: d.customer?.id ?? null, sellerId: d.sellerId || null, sellerName,
    soldAt: new Date().toISOString(), saleMode: d.mode, discount: t.discount, paidAmount: Math.min(t.paid, t.total),
    paymentMethod: d.paymentMethod, note: d.note, offline,
    lines: d.lines.map((l) => {
      const u = l.units.find((x) => x.id === l.unitId)!;
      return { productId: l.productId, unitId: l.unitId, productCode: u.code, productName: l.productName, unitName: u.unitName,
        quantity: l.quantity, unitPrice: l.unitPrice, discount: l.discount, note: l.note || null, taxCode: l.taxCode };
    }),
  };
}

/** Màn bán hàng toàn màn hình (Bán nhanh / Bán thường), chạy được khi mất mạng. */
export function PosScreen() {
  const qc = useQueryClient();
  const { data: me } = useCurrentUser();
  const { data: users = [] } = useUserLookup();
  const branchId = me?.user.branches[0]?.id ?? "";
  const catalog = usePosCatalog(branchId);
  const tabs = usePosTabs(me?.user.id ?? "");
  const [paying, setPaying] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [online, setOnline] = useState(true);
  const onSynced = useCallback((code: string) => {
    toast.success(`Đã đồng bộ hóa đơn offline → ${code}`);
    SALES_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: k }));
  }, [qc]);
  const queue = useOfflineQueue(onSynced);
  const d = tabs.active;

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    // Service worker: cache giao diện để mở lại được màn bán hàng khi mất mạng
    navigator.serviceWorker?.register("/sw.js").catch(() => undefined);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);

  function addProduct(p: CatalogProduct, unitId: string) {
    const unit = p.units.find((u) => u.id === unitId) ?? p.units[0];
    tabs.setLines((lines) => {
      const same = lines.find((l) => l.productId === p.id && l.unitId === unit.id);
      if (same) return lines.map((l) => (l === same ? { ...l, quantity: l.quantity + 1 } : l));
      return [{ key: newId(), productId: p.id, productName: p.name, unitId: unit.id, units: p.units, quantity: 1,
        unitPrice: unit.price, discount: 0, note: "" }, ...lines];
    });
  }

  async function pay() {
    if (!d || paying || !d.lines.length) return;
    const t = cartTotals(d);
    if (!d.customer && t.paid < t.total) return toast.error("Khách lẻ phải thanh toán đủ — chọn khách hàng để ghi nợ");
    if (d.lines.some((l) => l.quantity <= 0)) return toast.error("Số lượng phải lớn hơn 0");
    const sellerName = users.find((u) => u.id === d.sellerId)?.fullName;
    setPaying(true);
    try {
      const inv = await api<{ code: string }>("/invoices", { method: "POST", body: toBody(d, branchId, sellerName, false) });
      toast.success(`Đã thanh toán hóa đơn ${inv.code}${t.paid > t.total ? ` — trả lại khách ${formatMoney(t.paid - t.total)}` : ""}`);
      tabs.resetActive();
      void catalog.refresh();
      SALES_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: k }));
    } catch (e) {
      if (isNetworkError(e)) {
        queue.enqueue({ id: d.id, createdAt: new Date().toISOString(), body: toBody(d, branchId, sellerName, true),
          customerName: d.customer?.name ?? "Khách lẻ", total: t.total, status: "pending" });
        toast.warning("Mất kết nối: đã lưu hóa đơn trên máy, sẽ tự đồng bộ khi có mạng");
        tabs.resetActive();
      } else {
        toast.error((e as Error).message);
      }
    } finally {
      setPaying(false);
    }
  }

  if (!me || !d) return <div className="p-6 text-sm text-muted-foreground">Đang tải màn bán hàng...</div>;
  const pending = queue.queue.length;

  return (
    <div className="flex h-screen flex-col bg-muted">
      <header className="flex h-12 shrink-0 items-center gap-3 bg-primary px-3 text-primary-foreground">
        <PosProductSearch products={catalog.products} onPick={addProduct} />
        <div className="flex min-w-0 flex-1 items-end gap-1 self-end overflow-x-auto">
          {tabs.tabs.map((t) => (
            <div key={t.id} className={`flex shrink-0 items-center gap-2 rounded-t-md px-3 py-2 text-sm ${t.id === d.id ? "bg-muted font-semibold text-foreground" : "hover:bg-white/10"}`}>
              <button onClick={() => tabs.setActiveId(t.id)}>{t.label}</button>
              <button aria-label={`Đóng ${t.label}`} onClick={() => (t.lines.length === 0 || confirm(`Đóng ${t.label}? Giỏ hàng sẽ bị xóa.`)) && tabs.close(t.id)}>
                <X className="size-3.5" /></button>
            </div>))}
          <button aria-label="Thêm hóa đơn" className="mb-1.5 rounded-full p-1 hover:bg-white/10" onClick={tabs.add}><Plus className="size-4" /></button>
        </div>
        <button onClick={() => setShowQueue(true)} title="Hóa đơn chờ đồng bộ"
          className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs ${online && !catalog.offline ? "" : "bg-orange-500"}`}>
          {online && !catalog.offline ? <Wifi className="size-4" /> : <CloudOff className="size-4" />}
          {pending > 0 ? `${pending} chờ đồng bộ` : online && !catalog.offline ? "Trực tuyến" : "Mất mạng"}
        </button>
        <Link href="/invoices" className="rounded-md p-1.5 hover:bg-white/10" title="Về trang quản lý"><Undo2 className="size-4" /></Link>
        <span className="text-sm">{me.user.fullName}</span>
      </header>
      <main className="flex min-h-0 flex-1 gap-3 p-3">
        <section className="flex min-w-0 flex-1 flex-col gap-3">
          <div className={`overflow-y-auto ${d.mode === "NORMAL" ? "h-1/2" : "flex-1"}`}>
            <PosCart lines={d.lines} onChange={tabs.setLines} />
          </div>
          {d.mode === "NORMAL" && <PosProductGrid products={catalog.products} onPick={addProduct} />}
        </section>
        <aside className="w-96 shrink-0 rounded-lg bg-background p-4">
          <PosCheckoutPanel draft={d} branchId={branchId} update={tabs.update} onPay={pay} paying={paying} />
        </aside>
      </main>
      <footer className="flex h-11 shrink-0 items-center gap-1 bg-background px-3 text-sm">
        {([["QUICK", "Bán nhanh", Zap], ["NORMAL", "Bán thường", LayoutGrid]] as const).map(([m, label, Icon]) => (
          <button key={m} onClick={() => tabs.update({ mode: m })}
            className={`flex h-full items-center gap-2 border-t-2 px-4 ${d.mode === m ? "border-primary text-primary" : "border-transparent"}`}>
            <Icon className="size-4" /> {label}</button>))}
        {catalog.loadedAt && <span className="ml-auto text-xs text-muted-foreground">Danh mục cập nhật {new Date(catalog.loadedAt).toLocaleTimeString("vi-VN")}</span>}
      </footer>
      {showQueue && <PosQueueDialog queue={queue.queue} onRetry={queue.retry} onRemove={queue.remove} onClose={() => setShowQueue(false)} />}
    </div>
  );
}
