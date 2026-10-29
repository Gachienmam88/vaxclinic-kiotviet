"use client";

import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";
import { useCurrentUser } from "@/lib/use-current-user";
import { saleNs } from "@/messages/sale";
import { loadVnAdmin } from "@/lib/vn-admin-data";
import { useUserLookup } from "@/features/purchases/purchase-queries";
import { SALES_KEYS } from "@/features/sales/sales-queries";
import { SaleCart } from "./sale-cart";
import { SaleCheckoutPanel } from "./sale-checkout-panel";
import { SaleDeliveryLayout } from "./sale-delivery-layout";
import { SaleEInvoiceBox } from "./sale-einvoice-dialog";
import { SaleFooter } from "./sale-footer";
import { SaleHeader } from "./sale-header";
import { draftFromInvoice } from "./sale-open-invoice";
import { draftFromOrder } from "./sale-open-order";
import { SaleProductGrid } from "./sale-product-grid";
import { ReturnCheckout } from "./sale-return-checkout";
import { ReturnLines } from "./sale-return-panel";
import { SaleScreenDialogs, type SaleDialog } from "./sale-screen-dialogs";
import { SaleOrderNote } from "./sale-ui-parts";
import { addProductToTab } from "./sale-add-product";
import { deliveryProblem, walkInMustPayFull } from "./sale-invoice-body";
import { newId } from "./sale-storage";
import { useOfflineQueue } from "./use-offline-queue";
import { useSaleCatalog } from "./use-sale-catalog";
import { useSaleInvoiceSubmit } from "./use-sale-invoice-submit";
import { focusQty, useSaleLineKeys } from "./use-sale-line-keys";
import { useSaleLookups } from "./use-sale-lookups";
import { useSaleOrderSubmit } from "./use-sale-order-submit";
import { useSalePriceBook } from "./use-sale-price-book";
import { returnProblem, submitReturnDoc } from "./use-sale-return-submit";
import { SaleSettingsProvider, useSaleSettings } from "./use-sale-settings";
import { focusCustomerSearch, toggleFullscreen, useSaleShortcuts } from "./use-sale-shortcuts";
import { useSaleBranch } from "./use-sale-branch";
import { useSaleTaxPreview } from "./use-sale-tax-preview";
import { cartTotals, useSaleTabs } from "./use-sale-tabs";
import { openPicked, useSaleUrlDrafts } from "./use-sale-url-drafts";
import { useSaleNewTabParam } from "./use-sale-new-tab-param";
import type { ImportedSheet } from "./sale-import-workbook";
import type { CatalogProduct } from "./sale-types";

/** Màn bán hàng toàn màn hình (Bán nhanh / Bán thường / Bán giao hàng), chạy được khi mất mạng. Thiết lập lưu theo máy. */
export function SaleScreen() {
  return <SaleSettingsProvider><SaleScreenBody /></SaleSettingsProvider>;
}

function SaleScreenBody() {
  const qc = useQueryClient();
  const t = useT(saleNs);
  const { settings, set } = useSaleSettings();
  const { data: me } = useCurrentUser();
  const { data: users = [] } = useUserLookup();
  const branch = useSaleBranch(me?.user.id, me?.user.branches ?? []); // đổi chi nhánh → tải lại danh mục / bảng giá
  const branchId = branch.id;
  const userId = me?.user.id ?? "";
  const catalog = useSaleCatalog(branchId);
  const tabs = useSaleTabs(userId, { paymentMethod: settings.defaultPaymentMethod, paidEqualsDue: settings.paidEqualsDue });
  const [paying, setPaying] = useState(false);
  const [dialog, setDialog] = useState<SaleDialog>(null);
  const [online, setOnline] = useState(true);
  const onSynced = useCallback((code: string) => {
    toast.success(t("screen.syncedOffline", { code }));
    SALES_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: k }));
  }, [qc, t]);
  const queue = useOfflineQueue(onSynced);
  const d = tabs.active;
  const submitOrder = useSaleOrderSubmit(tabs, branchId, queue.enqueue);
  const submitInvoice = useSaleInvoiceSubmit(tabs, branchId, queue.enqueue);
  const priceBook = useSalePriceBook(tabs, catalog.priceBooks, branchId, !!catalog.loadedAt);
  const lookups = useSaleLookups();
  useSaleTaxPreview(tabs, branchId); // "Giảm thuế": số server tính theo phương pháp tính thuế
  const lineKeys = useSaleLineKeys(d?.lines ?? [], settings, tabs.setLines);
  useSaleUrlDrafts(me?.user.id, catalog.products, catalog.loadedAt, tabs.open);
  useSaleNewTabParam(tabs.tabs.length > 0, () => tabs.add());

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    // Service worker: cache giao diện để mở lại được màn bán hàng khi mất mạng
    navigator.serviceWorker?.register("/sw.js").catch(() => undefined);
    loadVnAdmin().catch(() => undefined); // danh mục khu vực giao hàng: tải sẵn vào bộ nhớ (SW giữ bản offline)
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);

  const refreshAfterSave = () => { void catalog.refresh(); SALES_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: k })); };

  const addProduct = (p: CatalogProduct, unitId: string) => {
    const key = addProductToTab(t, tabs, p, unitId, priceBook.resolve, settings.mergeSameItems);
    if (key) { lineKeys.select(key); if (settings.qtyInputMode) focusQty(key); }
  };

  async function pay() {
    if (!d || paying) return;
    if (d.kind === "RETURN") {
      const problem = returnProblem(t, d, (id) => !!catalog.products.find((p) => p.id === id)?.lotManaged);
      if (problem) return toast.error(problem);
      setPaying(true);
      if (await submitReturnDoc(t, d, branchId, queue.enqueue)) { tabs.close(d.id); refreshAfterSave(); }
      setPaying(false);
      return;
    }
    if (!d.lines.length) return;
    const totals = cartTotals(d);
    if (walkInMustPayFull(d) && totals.paid < totals.total) return toast.error(t("screen.walkInMustPayFull"));
    const missing = deliveryProblem(t, d);
    if (missing) return toast.error(missing);
    if (d.lines.some((l) => l.quantity <= 0)) return toast.error(t("screen.qtyPositive"));
    const sellerName = users.find((u) => u.id === d.sellerId)?.fullName;
    setPaying(true);
    if (d.kind === "ORDER") await submitOrder(d, sellerName); // Đặt hàng: không trừ kho
    else if (await submitInvoice(d, sellerName)) refreshAfterSave();
    setPaying(false);
  }

  function onImported(sheets: ImportedSheet[]) {
    tabs.openMany((label, i) => {
      const s = sheets[i];
      return { ...tabs.blankTab(label), customer: s.customer, lines: s.lines.map((l) => ({ key: newId(), productId: l.product.id,
        productName: l.product.name, unitId: l.unit.id, units: l.product.units, quantity: l.quantity, unitPrice: l.unitPrice,
        discount: l.discount, note: "", taxCode: l.product.taxCode, taxReduction: !!l.product.taxReduction, priceEdited: true })).reverse() };
    }, sheets.length);
  }

  useSaleShortcuts({
    NEW_INVOICE: () => tabs.add(),
    TOGGLE_AUTO_PRINT: () => { set({ autoPrint: !settings.autoPrint }); toast.info(t(settings.autoPrint ? "screen.autoPrintOff" : "screen.autoPrintOn")); },
    FOCUS_PRODUCT: () => document.getElementById("sale-product-search")?.focus(),
    FOCUS_CUSTOMER: focusCustomerSearch,
    TOGGLE_QTY_MODE: () => { set({ qtyInputMode: !settings.qtyInputMode }); toast.info(t(settings.qtyInputMode ? "screen.qtyModeOff" : "screen.qtyModeOn")); },
    FOCUS_PAID: () => (document.getElementById("sale-paid") as HTMLInputElement | null)?.focus(),
    PAY: () => void pay(),
    FULLSCREEN: toggleFullscreen,
    ...lineKeys.handlers,
  });

  if (!me || !d) return <div className="p-6 text-sm text-muted-foreground">{t("screen.loading")}</div>;
  const cartView = !d.returnOf;
  // Bán giao hàng: bố cục 3 cột riêng (giỏ hàng | thông tin giao | đối tác + THANH TOÁN)
  const deliveryView = cartView && d.mode === "DELIVERY" && d.kind !== "ORDER" && d.kind !== "RETURN" && !d.quickReturn;
  const cart = (
    <SaleCart lines={d.lines} customerId={d.customer?.id ?? null} onChange={tabs.setLines} resolveUnit={priceBook.resolve}
      products={catalog.products} branchId={branchId} quickReturn={!!d.quickReturn} selectedKey={lineKeys.selected} onSelect={lineKeys.select} />
  );

  return (
    <div className="flex h-screen flex-col bg-[#e8eaed] text-[13px] text-[#1f2329] dark:bg-muted dark:text-foreground">
      <SaleHeader products={catalog.products} onPick={addProduct} tabs={tabs} online={online && !catalog.offline}
        pending={queue.queue.length} userName={me.user.fullName} onAction={setDialog} />
      <main className="flex min-h-0 flex-1 gap-2 p-2">
        {deliveryView ? (
          <SaleDeliveryLayout draft={d} update={tabs.update} lookups={lookups} branch={branch} cart={cart} onPay={pay} paying={paying} />
        ) : (<>
        <section className="flex min-w-0 flex-1 flex-col gap-2">
          {!cartView ? (
            <div className="min-h-0 flex-1 overflow-y-auto"><ReturnLines draft={d} update={tabs.update} /></div>
          ) : (
            <>
              <div className={`min-h-0 overflow-y-auto ${d.mode === "NORMAL" && !d.quickReturn ? "h-1/2" : "flex-1"}`}>{cart}</div>
              {d.mode === "NORMAL" && !d.quickReturn && <SaleProductGrid products={catalog.products} onPick={addProduct} />}
            </>
          )}
          <div className="flex gap-2 px-2.5 pb-0.5">
            <div className="min-w-0 flex-1"><SaleOrderNote value={d.note} onChange={(note) => tabs.update({ note })} /></div>
            {d.kind !== "ORDER" && d.kind !== "RETURN" && <SaleEInvoiceBox value={d.einvoiceBuyer} customer={d.customer} onChange={(einvoiceBuyer) => tabs.update({ einvoiceBuyer })} />}
          </div>
        </section>
        <aside className="flex w-[406px] shrink-0 flex-col rounded-lg bg-background px-4 pt-2.5 pb-4">
          {d.kind === "RETURN"
            ? <ReturnCheckout draft={d} branchId={branchId} update={tabs.update} onSubmit={pay} busy={paying} />
            : <SaleCheckoutPanel draft={d} branchId={branchId} update={tabs.update} onPay={pay} paying={paying} priceBook={priceBook} lookups={lookups} branch={branch} />}
        </aside>
        </>)}
      </main>
      <SaleFooter mode={d.mode} showModes={d.kind !== "RETURN"} allowDelivery={d.kind !== "ORDER"} loadedAt={catalog.loadedAt}
        onMode={(mode) => tabs.update(mode === "DELIVERY" || d.mode === "DELIVERY" ? { mode, paid: null, extraPayments: [] } : { mode })}
        onHelp={() => setDialog("SHORTCUTS")} />
      <SaleScreenDialogs dialog={dialog} close={() => setDialog(null)} branchId={branchId} userName={me.user.fullName}
        online={online && !catalog.offline} catalog={catalog.products} queue={queue} onImported={onImported}
        onPickOrder={(id) => openPicked(draftFromOrder(id, "invoice", catalog.products, me.user.id, t), tabs.open, t("screen.what.order"), t)}
        onPickReturn={(id) => openPicked(draftFromInvoice(id, "return", catalog.products, me.user.id, t), tabs.open, t("screen.what.invoice"), t)}
        onQuickReturn={() => tabs.add("QUICK_RETURN")} />
    </div>
  );
}
