"use client";

import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { formatMoney } from "@/lib/format";
import { useCurrentUser } from "@/lib/use-current-user";
import { useUserLookup } from "@/features/purchases/purchase-queries";
import { SALES_KEYS } from "@/features/sales/sales-queries";
import type { Invoice } from "@/features/sales/sales-types";
import { usePrinter } from "@/features/print/print-button";
import { invoiceData } from "@/features/print/print-data";
import { useRouter, useSearchParams } from "next/navigation";
import { PosCart } from "./pos-cart";
import { draftFromInvoice } from "./pos-open-invoice";
import { ReturnLines, returnTotals } from "./pos-return-panel";
import { ReturnCheckout } from "./pos-return-checkout";
import { PosCheckoutPanel } from "./pos-checkout-panel";
import { PosProductGrid } from "./pos-product-grid";
import { PosFooter } from "./pos-footer";
import { PosHeader } from "./pos-header";
import { toBody } from "./pos-invoice-body";
import { PosOrderNote } from "./pos-ui-parts";
import { PosQueueDialog } from "./pos-queue-dialog";
import { isNetworkError, newId } from "./pos-storage";
import { useOfflineQueue } from "./use-offline-queue";
import { usePosCatalog } from "./use-pos-catalog";
import { cartTotals, usePosTabs } from "./use-pos-tabs";
import type { CatalogProduct } from "./pos-types";

/** Màn bán hàng toàn màn hình (Bán nhanh / Bán thường), chạy được khi mất mạng. */
export function PosScreen() {
  const qc = useQueryClient();
  const printDoc = usePrinter();
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
  const params = useSearchParams();
  const router = useRouter();

  // /pos?edit=<id> (nút "Chỉnh sửa") hoặc /pos?return=<id> (nút "Trả hàng") từ chi tiết hóa đơn
  useEffect(() => {
    const editId = params.get("edit");
    const returnId = params.get("return");
    if (!me || !(editId || returnId) || (editId && !catalog.loadedAt)) return;
    draftFromInvoice((editId ?? returnId)!, editId ? "edit" : "return", catalog.products, me.user.id)
      .then((draft) => { tabs.open(draft); router.replace("/pos"); })
      .catch((e) => toast.error(`Không mở được hóa đơn: ${(e as Error).message}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chạy 1 lần khi có đủ user + danh mục
  }, [me, params, catalog.loadedAt]);

  async function submitReturn() {
    if (!d?.returnOf || paying) return;
    const t = returnTotals(d);
    if (!d.customer && t.refund < t.total) return toast.error("Khách lẻ: phải trả đủ tiền cho khách");
    setPaying(true);
    try {
      const r = await api<{ code: string }>("/sales-returns", { method: "POST", body: {
        id: d.id, invoiceId: d.returnOf.invoiceId, discount: t.discount, fee: t.fee, refundAmount: t.refund,
        paymentMethod: d.paymentMethod, note: d.note,
        lines: d.returnOf.lines.filter((l) => l.quantity > 0).map((l) => ({ invoiceLineId: l.invoiceLineId, quantity: l.quantity })) } });
      toast.success(`Đã tạo phiếu trả hàng ${r.code}${t.refund > 0 ? ` — trả khách ${formatMoney(t.refund)}` : ""}`);
      tabs.close(d.id);
      void catalog.refresh();
      SALES_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: k }));
    } catch (e) {
      toast.error(isNetworkError(e) ? "Mất kết nối: trả hàng cần có mạng, vui lòng thử lại" : (e as Error).message);
    } finally {
      setPaying(false);
    }
  }

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
    // Tab trả hàng ("Tìm hàng trả (F3)"): tăng số lượng trả của dòng hóa đơn cùng mã, không thêm vào giỏ bán
    if (d?.returnOf) {
      const r = d.returnOf;
      const line = r.lines.find((l) => l.productCode === unit.code) ?? r.lines.find((l) => p.units.some((u) => u.code === l.productCode));
      if (!line) { toast.error(`${p.name} không có trong hóa đơn ${r.code}`); return; }
      const max = line.sold - line.returned;
      if (line.quantity >= max) { toast.error(`${line.productName}: chỉ còn trả được ${max}`); return; }
      tabs.update({ returnOf: { ...r, lines: r.lines.map((l) => (l === line ? { ...l, quantity: l.quantity + 1 } : l)) } });
      return;
    }
    tabs.setLines((lines) => {
      const same = lines.find((l) => l.productId === p.id && l.unitId === unit.id);
      if (same) return lines.map((l) => (l === same ? { ...l, quantity: l.quantity + 1 } : l));
      return [{ key: newId(), productId: p.id, productName: p.name, unitId: unit.id, units: p.units, quantity: 1,
        unitPrice: unit.price, discount: 0, note: "", taxCode: p.taxCode }, ...lines];
    });
  }

  async function pay() {
    if (!d || paying || !d.lines.length) return;
    const t = cartTotals(d);
    if (!d.customer && t.paid < t.total) return toast.error("Khách lẻ phải thanh toán đủ — chọn khách hàng để ghi nợ");
    if (d.lines.some((l) => l.quantity <= 0)) return toast.error("Số lượng phải lớn hơn 0");
    const sellerName = users.find((u) => u.id === d.sellerId)?.fullName;
    setPaying(true);
    if (d.editOf) { // Lưu bản sửa hóa đơn (cần mạng; kho hoàn lô cũ + xuất lô mới trong 1 giao dịch)
      try {
        const inv = await api<{ code: string }>(`/invoices/${d.editOf.invoiceId}?revision=${d.editOf.revision}`,
          { method: "PUT", body: { ...toBody(d, branchId, sellerName, false), soldAt: undefined } });
        toast.success(`Đã cập nhật hóa đơn ${inv.code}`);
        tabs.close(d.id);
        void catalog.refresh();
        SALES_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: k }));
      } catch (e) {
        toast.error(isNetworkError(e) ? "Mất kết nối: sửa hóa đơn cần có mạng, vui lòng thử lại" : (e as Error).message);
      } finally {
        setPaying(false);
      }
      return;
    }
    try {
      const inv = await api<Invoice>("/invoices", { method: "POST", body: toBody(d, branchId, sellerName, false) });
      toast.success(`Đã thanh toán hóa đơn ${inv.code}${t.paid > t.total ? ` — trả lại khách ${formatMoney(t.paid - t.total)}` : ""}`,
        { duration: 8000, action: { label: "In hóa đơn", onClick: () => printDoc("INVOICE", invoiceData(inv), branchId) } });
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
    <div className="flex h-screen flex-col bg-[#e8eaed] text-[13px] text-[#1f2329] dark:bg-muted dark:text-foreground">
      <PosHeader products={catalog.products} onPick={addProduct} tabs={tabs} online={online && !catalog.offline}
        pending={pending} onShowQueue={() => setShowQueue(true)} userName={me.user.fullName} />
      <main className="flex min-h-0 flex-1 gap-2 p-2">
        <section className="flex min-w-0 flex-1 flex-col gap-2">
          {d.returnOf ? (
            <div className="min-h-0 flex-1 overflow-y-auto"><ReturnLines draft={d} update={tabs.update} /></div>
          ) : (
            <>
              <div className={`min-h-0 overflow-y-auto ${d.mode === "NORMAL" ? "h-1/2" : "flex-1"}`}>
                <PosCart lines={d.lines} customerId={d.customer?.id ?? null} onChange={tabs.setLines} />
              </div>
              {d.mode === "NORMAL" && <PosProductGrid products={catalog.products} onPick={addProduct} />}
            </>
          )}
          <div className="px-2.5 pb-0.5"><PosOrderNote value={d.note} onChange={(note) => tabs.update({ note })} /></div>
        </section>
        <aside className="flex w-[406px] shrink-0 flex-col rounded-lg bg-background px-4 pt-2.5 pb-4">
          {d.returnOf
            ? <ReturnCheckout draft={d} update={tabs.update} onSubmit={submitReturn} busy={paying} />
            : <PosCheckoutPanel draft={d} branchId={branchId} update={tabs.update} onPay={pay} paying={paying} />}
        </aside>
      </main>
      <PosFooter mode={d.mode} showModes={!d.returnOf} onMode={(mode) => tabs.update({ mode })} loadedAt={catalog.loadedAt} />
      {showQueue && <PosQueueDialog queue={queue.queue} onRetry={queue.retry} onRemove={queue.remove} onClose={() => setShowQueue(false)} />}
    </div>
  );
}
