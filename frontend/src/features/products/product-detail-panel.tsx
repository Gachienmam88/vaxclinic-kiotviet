"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImageIcon, Lock, LockOpen, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, errorMessage } from "@/lib/api-client";
import { formatMoney, formatNumber } from "@/lib/format";
import { useCurrentUser } from "@/lib/use-current-user";
import { LedgerTab, StockTab, UnitsTab } from "./product-detail-tabs";
import { useProduct } from "./product-queries";
import type { ProductDetail } from "./product-types";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border-b pb-1.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value || <span className="font-normal text-muted-foreground">Chưa có</span>}</div>
    </div>
  );
}

function InfoTab({ p }: { p: ProductDetail }) {
  const base = p.units.find((u) => u.base)!;
  const stock = p.stocks.reduce((s, b) => s + Number(b.quantity), 0);
  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <div className="flex size-24 items-center justify-center rounded-md bg-primary/10 text-primary">
          <ImageIcon className="size-10" />
        </div>
        <div className="space-y-1.5">
          <h3 className="flex flex-wrap items-center gap-2 text-lg font-semibold">
            {p.name} {p.units.map((u) => <Badge key={u.id} variant="secondary">{u.unitName}</Badge>)}
          </h3>
          <p className="text-sm text-muted-foreground">Nhóm hàng: {p.categoryName}</p>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline">{p.lotManaged ? "Quản lý theo lô, HSD" : "Không quản lý lô"}</Badge>
            {base.directSale && <Badge variant="outline">Bán trực tiếp</Badge>}
            {!p.loyaltyPoints && <Badge variant="outline" className="text-orange-600">Không tích điểm</Badge>}
            {!p.active && <Badge variant="destructive">Ngừng kinh doanh</Badge>}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-8 gap-y-3 md:grid-cols-4">
        <Field label="Mã hàng" value={base.code} />
        <Field label="Mã vạch" value={base.barcode} />
        <Field label="Tồn kho" value={formatNumber(stock)} />
        <Field label="Định mức tồn" value={`${formatNumber(p.minStock)} - ${formatNumber(p.maxStock)}`} />
        <Field label="Giá vốn" value={formatNumber(p.cost)} />
        <Field label="Giá bán" value={formatMoney(base.price)} />
        <Field label="Tỷ lệ tính thuế" value={p.taxRateName} />
        <Field label="Áp dụng giảm thuế" value={p.taxReduction ? "Có" : "Không áp dụng"} />
        <Field label="Vị trí" value={p.positionName} />
        <Field label="Trọng lượng" value={p.weight ? `${formatNumber(p.weight)} ${p.weightUnit}` : null} />
        <Field label="Tên hàng trên hóa đơn điện tử" value={p.einvoiceName} />
        <Field label="Tên viết tắt" value={p.shortName} />
      </div>
    </div>
  );
}

type Props = { productId: string; onEdit: (p: ProductDetail) => void };

/** Panel chi tiết mở ngay dưới dòng hàng hóa được chọn. */
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

  if (isLoading || !p) return <div className="p-6 text-sm text-muted-foreground">Đang tải...</div>;

  return (
    <div className="border-x-2 border-b-2 border-primary/40 bg-background p-4">
      <Tabs defaultValue="info">
        <TabsList variant="line">
          <TabsTrigger value="info">Thông tin</TabsTrigger>
          <TabsTrigger value="desc">Mô tả, ghi chú</TabsTrigger>
          <TabsTrigger value="ledger">Thẻ kho</TabsTrigger>
          <TabsTrigger value="stock">Tồn kho</TabsTrigger>
          <TabsTrigger value="units">Hàng hóa cùng loại</TabsTrigger>
        </TabsList>
        <TabsContent value="info" className="pt-3"><InfoTab p={p} /></TabsContent>
        <TabsContent value="desc" className="space-y-3 pt-3 text-sm">
          <Field label="Mô tả" value={p.description && <p className="whitespace-pre-wrap">{p.description}</p>} />
          <Field label="Ghi chú" value={p.note && <p className="whitespace-pre-wrap">{p.note}</p>} />
        </TabsContent>
        <TabsContent value="ledger" className="pt-3"><LedgerTab productId={p.id} /></TabsContent>
        <TabsContent value="stock" className="pt-3"><StockTab product={p} /></TabsContent>
        <TabsContent value="units" className="pt-3"><UnitsTab product={p} /></TabsContent>
      </Tabs>
      {can("catalog.manage") && (
        <div className="mt-4 flex justify-end gap-2 border-t pt-3">
          <Button variant="outline" className="text-destructive" disabled={remove.isPending}
            onClick={() => confirm(`Xóa hàng hóa "${p.name}"?`) && remove.mutate()}>
            <Trash2 className="size-4" /> Xóa
          </Button>
          <Button variant="outline" disabled={toggleActive.isPending} onClick={() => toggleActive.mutate()}>
            {p.active ? <><Lock className="size-4" /> Ngừng kinh doanh</> : <><LockOpen className="size-4" /> Cho phép kinh doanh</>}
          </Button>
          <Button onClick={() => onEdit(p)}><Pencil className="size-4" /> Chỉnh sửa</Button>
        </div>
      )}
    </div>
  );
}
