"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api, errorMessage } from "@/lib/api-client";
import { useCurrentUser } from "@/lib/use-current-user";
import { NativeSelect, PriceSection, StockSection } from "./product-form-sections";
import { emptyProductForm, formFromDetail, toRequest, type ProductForm } from "./product-form-state";
import { PositionWeightSection, UnitsSection } from "./product-form-units-section";
import { flattenCategoryTree, useCategories } from "./product-queries";
import type { ProductDetail } from "./product-types";

type Props = { product?: ProductDetail; onClose: () => void };

/** Tạo / sửa hàng hóa. Tab Thông tin gồm các khối: giá, tồn kho, vị trí, đơn vị tính; tab Mô tả. */
export function ProductFormDialog({ product, onClose }: Props) {
  const qc = useQueryClient();
  const isCreate = !product;
  const { data: me } = useCurrentUser();
  const { data: categories = [] } = useCategories();
  const blank = () => emptyProductForm({ branchId: me?.user.branches[0]?.id });
  const [form, setForm] = useState<ProductForm>(() => (product ? formFromDetail(product) : blank()));
  const set = (patch: Partial<ProductForm>) => setForm((f) => ({ ...f, ...patch }));
  const base = form.units[0];
  const setBase = (patch: object) => set({ units: form.units.map((u, i) => (i === 0 ? { ...u, ...patch } : u)) });

  const save = useMutation({
    mutationFn: () => isCreate
      ? api<ProductDetail>("/products", { method: "POST", body: toRequest(form, true) })
      : api<ProductDetail>(`/products/${product.id}`, { method: "PUT", body: toRequest(form, false) }),
    onSuccess: (saved) => {
      toast.success(isCreate ? `Đã tạo hàng hóa ${saved.units[0]?.code}` : "Đã cập nhật hàng hóa");
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["product", saved.id] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  async function createCategory() {
    const name = prompt("Tên nhóm hàng mới")?.trim();
    if (!name) return;
    try {
      const c = await api<{ id: string }>("/categories", { method: "POST", body: { name } });
      await qc.invalidateQueries({ queryKey: ["categories"] });
      set({ categoryId: c.id });
    } catch (e) { toast.error(errorMessage(e)); }
  }

  function submit(andNew: boolean) {
    if (!form.name.trim()) return toast.error("Nhập tên hàng");
    if (!form.categoryId) return toast.error("Chọn nhóm hàng");
    if (!base.unitName.trim()) return toast.error("Nhập tên đơn vị cơ bản");
    save.mutate(undefined, {
      // "Lưu & Tạo thêm hàng": giữ nhóm hàng + thuế, xóa phần còn lại để nhập hàng kế tiếp.
      onSuccess: () => (andNew ? setForm({ ...blank(), categoryId: form.categoryId, taxRateId: form.taxRateId }) : onClose()),
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 p-0 sm:max-w-4xl">
        <DialogHeader className="px-5 pt-4">
          <DialogTitle>{isCreate ? "Tạo hàng hóa" : "Sửa hàng hóa"}</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="info" className="min-h-0 flex-1">
          <TabsList variant="line" className="px-5">
            <TabsTrigger value="info">Thông tin</TabsTrigger>
            <TabsTrigger value="desc">Mô tả</TabsTrigger>
          </TabsList>
          <TabsContent value="info" className="space-y-3 overflow-y-auto px-5 py-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="grid gap-1.5"><Label>Mã hàng</Label>
                <Input placeholder="Tự động" value={base.code} onChange={(e) => setBase({ code: e.target.value })} /></div>
              <div className="grid gap-1.5"><Label>Mã vạch</Label>
                <Input placeholder="Nhập mã vạch" value={base.barcode} onChange={(e) => setBase({ barcode: e.target.value })} /></div>
              <div className="grid gap-1.5 md:col-span-2"><Label>Tên hàng</Label>
                <Input placeholder="Bắt buộc" value={form.name} onChange={(e) => set({ name: e.target.value })} /></div>
              <div className="grid gap-1.5"><Label>Tên hàng trên hóa đơn điện tử</Label>
                <Input value={form.einvoiceName} onChange={(e) => set({ einvoiceName: e.target.value })} /></div>
              <div className="grid gap-1.5"><Label>Tên viết tắt</Label>
                <Input value={form.shortName} onChange={(e) => set({ shortName: e.target.value })} /></div>
              <div className="grid gap-1.5 md:col-span-2">
                <div className="flex justify-between"><Label>Nhóm hàng</Label>
                  <button type="button" className="text-xs text-primary" onClick={createCategory}>Tạo mới</button></div>
                <NativeSelect value={form.categoryId} onChange={(e) => set({ categoryId: e.target.value })}>
                  <option value="">Chọn nhóm hàng (Bắt buộc)</option>
                  {flattenCategoryTree(categories).map((c) => (
                    <option key={c.id} value={c.id}>{"  ".repeat(c.depth)}{c.name}</option>
                  ))}
                </NativeSelect>
              </div>
            </div>
            <PriceSection form={form} set={set} isCreate={isCreate} />
            <StockSection form={form} set={set} isCreate={isCreate} />
            <PositionWeightSection form={form} set={set} isCreate={isCreate} />
            <UnitsSection form={form} set={set} isCreate={isCreate} />
          </TabsContent>
          <TabsContent value="desc" className="space-y-3 px-5 py-3">
            <div className="grid gap-1.5"><Label>Mô tả</Label>
              <Textarea rows={6} value={form.description} onChange={(e) => set({ description: e.target.value })} /></div>
            <div className="grid gap-1.5"><Label>Ghi chú</Label>
              <Textarea rows={3} value={form.note} onChange={(e) => set({ note: e.target.value })} /></div>
          </TabsContent>
        </Tabs>
        <DialogFooter className="m-0 items-center border-t px-5 py-3 sm:justify-between">
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <Checkbox checked={base.directSale} onCheckedChange={(v) => setBase({ directSale: v === true })} /> Bán trực tiếp
            </label>
            <label className="flex items-center gap-2">
              <Checkbox checked={form.loyaltyPoints} onCheckedChange={(v) => set({ loyaltyPoints: v === true })} /> Tích điểm
            </label>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Bỏ qua</Button>
            {isCreate && (
              <Button variant="outline" disabled={save.isPending} onClick={() => submit(true)}>Lưu & Tạo thêm hàng</Button>
            )}
            <Button disabled={save.isPending} onClick={() => submit(false)}>Lưu</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
