"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Lock, LockOpen, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, errorMessage } from "@/lib/api-client";
import { useCurrentUser } from "@/lib/use-current-user";
import { DetailField, ProductInfoTab } from "./product-detail-info-tab";
import { LedgerTab, StockTab, UnitsTab } from "./product-detail-tabs";
import { useProduct } from "./product-queries";
import { LINE_TABS_LIST, LINE_TABS_TRIGGER } from "./product-tab-styles";
import type { ProductDetail } from "./product-types";

type Props = { productId: string; onEdit: (p: ProductDetail) => void };

const BTN = "h-8 rounded-md";

/** Panel chi tiết mở ngay dưới dòng hàng hóa được chọn (viền xanh 1px, tab gạch chân xanh). */
export function ProductDetailPanel({ productId, onEdit }: Props) {
  const qc = useQueryClient();
  const { can } = useCurrentUser();
  const { data: p, isLoading } = useProduct(productId);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["product", productId] });
  };
  const toggleActive = useMutation({
    mutationFn: () => api(`/products/${productId}/active`, { method: "PATCH", body: { active: !p?.active } }),
    onSuccess: () => { toast.success(p?.active ? "Đã ngừng kinh doanh" : "Đã cho phép kinh doanh"); refresh(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: () => api(`/products/${productId}`, { method: "DELETE" }),
    onSuccess: () => { toast.success("Đã xóa hàng hóa"); refresh(); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (isLoading || !p) {
    return <div className="border border-primary bg-background p-6 text-[13px] text-muted-foreground">Đang tải...</div>;
  }

  return (
    <div className="border border-primary bg-background">
      <Tabs defaultValue="info">
        <TabsList variant="line" className={LINE_TABS_LIST}>
          <TabsTrigger value="info" className={LINE_TABS_TRIGGER}>Thông tin</TabsTrigger>
          <TabsTrigger value="desc" className={LINE_TABS_TRIGGER}>Mô tả, ghi chú</TabsTrigger>
          <TabsTrigger value="ledger" className={LINE_TABS_TRIGGER}>Thẻ kho</TabsTrigger>
          <TabsTrigger value="stock" className={LINE_TABS_TRIGGER}>Tồn kho</TabsTrigger>
          <TabsTrigger value="units" className={LINE_TABS_TRIGGER}>Hàng hóa cùng loại</TabsTrigger>
        </TabsList>
        <TabsContent value="info" className="px-5 py-3"><ProductInfoTab p={p} /></TabsContent>
        <TabsContent value="desc" className="space-y-3 px-5 py-3">
          <DetailField label="Mô tả" value={p.description && <p className="whitespace-pre-wrap">{p.description}</p>} />
          <DetailField label="Ghi chú" value={p.note && <p className="whitespace-pre-wrap">{p.note}</p>} />
        </TabsContent>
        <TabsContent value="ledger" className="px-4 py-3"><LedgerTab productId={p.id} /></TabsContent>
        <TabsContent value="stock" className="px-4 py-3"><StockTab product={p} /></TabsContent>
        <TabsContent value="units" className="px-4 py-3"><UnitsTab product={p} /></TabsContent>
      </Tabs>
      {can("catalog.manage") && (
        <div className="flex justify-end gap-2 border-t border-[#e5e7eb] px-4 py-3">
          <Button variant="outline" className={`${BTN} text-destructive`} disabled={remove.isPending}
            onClick={() => confirm(`Xóa hàng hóa "${p.name}"?`) && remove.mutate()}>
            <Trash2 className="size-4" /> Xóa
          </Button>
          <Button variant="outline" className={BTN} disabled={toggleActive.isPending} onClick={() => toggleActive.mutate()}>
            {p.active ? <><Lock className="size-4" /> Ngừng kinh doanh</> : <><LockOpen className="size-4" /> Cho phép kinh doanh</>}
          </Button>
          <Button className={BTN} onClick={() => onEdit(p)}><Pencil className="size-4" /> Chỉnh sửa</Button>
        </div>
      )}
    </div>
  );
}
