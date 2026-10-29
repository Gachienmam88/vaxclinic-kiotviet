"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Barcode, Copy, Ellipsis, Lock, LockOpen, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DetailTabsList } from "@/components/ui/detail-tabs-list";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MAX_LABELS, printBarcodeLabels } from "@/features/print/barcode-label-print";
import { useShopSettings } from "@/features/settings/settings-queries";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { api, errorMessage } from "@/lib/api-client";
import { useCurrentUser } from "@/lib/use-current-user";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { productsNs } from "@/messages/products";
import { DetailField, ProductInfoTab } from "./product-detail-info-tab";
import { LedgerTab, StockTab, UnitsTab } from "./product-detail-tabs";
import { useProduct } from "./product-queries";
import { LINE_TABS_LIST, LINE_TABS_TRIGGER } from "./product-tab-styles";
import type { ProductDetail } from "./product-types";

type Props = { productId: string; onEdit: (p: ProductDetail) => void; onCopy: (p: ProductDetail) => void; onClose?: () => void };

const BTN = "h-8 rounded-md";

/**
 * Panel chi tiết mở ngay dưới dòng hàng hóa được chọn (viền xanh 1px, tab gạch chân xanh).
 * Chân như KiotViet: Xóa · Sao chép | Chỉnh sửa · In tem mã (1 tem / đơn vị tính) · "…" (Ngừng / Cho phép kinh doanh).
 */
export function ProductDetailPanel({ productId, onEdit, onCopy, onClose }: Props) {
  const qc = useQueryClient();
  const { can } = useCurrentUser();
  const { data: p, isLoading } = useProduct(productId);
  const t = useT(productsNs);
  const tc = useT(commonNs);
  const { data: shop } = useShopSettings();

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["product", productId] });
  };
  const toggleActive = useMutation({
    mutationFn: () => api(`/products/${productId}/active`, { method: "PATCH", body: { active: !p?.active } }),
    onSuccess: () => { toast.success(p?.active ? t("detail.toastDeactivated") : t("detail.toastActivated")); refresh(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: () => api(`/products/${productId}`, { method: "DELETE" }),
    onSuccess: () => { toast.success(t("detail.toastDeleted")); refresh(); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  /** 1 tem cho mỗi đơn vị tính (mã vạch nếu có, không thì mã hàng; giá chung của đơn vị). */
  const printLabels = (d: ProductDetail) => {
    const n = printBarcodeLabels(d.units.map((u) => ({ code: u.code, barcode: u.barcode, name: `${d.name} (${u.unitName})`, price: Number(u.price), copies: 1 })),
      shop?.store?.name ?? "");
    if (n >= MAX_LABELS) toast.info(tc("errors.labelsCapped", { max: MAX_LABELS }));
  };

  if (isLoading || !p) {
    return <div className="border border-primary bg-background p-6 text-[13px] text-muted-foreground">{tc("status.loading")}</div>;
  }

  return (
    <div className="border border-primary bg-background">
      <Tabs defaultValue="info">
        <DetailTabsList onActiveTabClick={onClose} variant="line" className={LINE_TABS_LIST}>
          <TabsTrigger value="info" className={LINE_TABS_TRIGGER}>{tc("detailTabs.info")}</TabsTrigger>
          <TabsTrigger value="desc" className={LINE_TABS_TRIGGER}>{t("detail.tabs.desc")}</TabsTrigger>
          <TabsTrigger value="ledger" className={LINE_TABS_TRIGGER}>{t("detail.tabs.ledger")}</TabsTrigger>
          <TabsTrigger value="stock" className={LINE_TABS_TRIGGER}>{t("fields.stock")}</TabsTrigger>
          <TabsTrigger value="units" className={LINE_TABS_TRIGGER}>{t("detail.tabs.units")}</TabsTrigger>
        </DetailTabsList>
        <TabsContent value="info" className="px-5 py-3"><ProductInfoTab p={p} /></TabsContent>
        <TabsContent value="desc" className="space-y-3 px-5 py-3">
          <DetailField label={tc("fields.description")} value={p.description && <p className="whitespace-pre-wrap">{p.description}</p>} />
          <DetailField label={tc("fields.note")} value={p.note && <p className="whitespace-pre-wrap">{p.note}</p>} />
        </TabsContent>
        <TabsContent value="ledger" className="px-4 py-3"><LedgerTab productId={p.id} /></TabsContent>
        <TabsContent value="stock" className="px-4 py-3"><StockTab product={p} /></TabsContent>
        <TabsContent value="units" className="px-4 py-3"><UnitsTab product={p} /></TabsContent>
      </Tabs>
      <div className="flex flex-wrap items-center gap-2 border-t border-[#e5e7eb] px-4 py-3">
        {can("catalog.manage") && <>
          <Button variant="ghost" className={`${BTN} text-destructive`} disabled={remove.isPending}
            onClick={() => confirm(t("detail.confirmDelete", { name: p.name })) && remove.mutate()}>
            <Trash2 className="size-4" /> {tc("actions.delete")}
          </Button>
          <Button variant="ghost" className={BTN} onClick={() => onCopy(p)}><Copy className="size-4" /> {tc("actions.copy")}</Button>
          <Button className={`${BTN} ml-auto`} onClick={() => onEdit(p)}><Pencil className="size-4" /> {t("detail.edit")}</Button>
        </>}
        <Button variant="outline" className={`${BTN} ${can("catalog.manage") ? "" : "ml-auto"}`} onClick={() => printLabels(p)}>
          <Barcode className="size-4" /> {tc("actions.printLabels")}</Button>
        {can("catalog.manage") && (
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex size-8 items-center justify-center rounded-md border hover:bg-muted" aria-label={tc("actions.more")}>
              <Ellipsis className="size-4" /></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled={toggleActive.isPending} onClick={() => toggleActive.mutate()}>
                {p.active ? <><Lock className="size-4" /> {t("detail.deactivate")}</> : <><LockOpen className="size-4" /> {t("detail.activate")}</>}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
