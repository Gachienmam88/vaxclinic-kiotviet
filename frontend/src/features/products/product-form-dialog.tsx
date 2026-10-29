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
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { productsNs } from "@/messages/products";
import { NativeSelect, PriceSection, StockSection } from "./product-form-sections";
import { copyFormFromDetail, emptyProductForm, formFromDetail, toRequest, type ProductForm } from "./product-form-state";
import { PositionWeightSection, UnitsSection } from "./product-form-units-section";
import { flattenCategoryTree, promptCreateCategory, useCategories } from "./product-queries";
import { LINE_TABS_LIST, LINE_TABS_TRIGGER } from "./product-tab-styles";
import type { ProductDetail } from "./product-types";

/** product = sửa hàng đó; copyFrom = tạo mới điền sẵn từ hàng khác ("Sao chép"). */
type Props = { product?: ProductDetail; copyFrom?: ProductDetail; onClose: () => void };

const FOOTER_BTN = "h-8 rounded-md px-3 font-semibold";

/** Tạo / sửa hàng hóa. Tab Thông tin gồm các khối: giá, tồn kho, vị trí, đơn vị tính; tab Mô tả. */
export function ProductFormDialog({ product, copyFrom, onClose }: Props) {
  const qc = useQueryClient();
  const t = useT(productsNs);
  const tc = useT(commonNs);
  const isCreate = !product;
  const { data: me } = useCurrentUser();
  const { data: categories = [] } = useCategories();
  const blank = () => emptyProductForm({ branchId: me?.user.branches[0]?.id });
  const [form, setForm] = useState<ProductForm>(() =>
    (product ? formFromDetail(product) : copyFrom ? copyFormFromDetail(copyFrom, blank()) : blank()));
  const set = (patch: Partial<ProductForm>) => setForm((f) => ({ ...f, ...patch }));
  const base = form.units[0];
  const setBase = (patch: object) => set({ units: form.units.map((u, i) => (i === 0 ? { ...u, ...patch } : u)) });

  const save = useMutation({
    mutationFn: () => isCreate
      ? api<ProductDetail>("/products", { method: "POST", body: toRequest(form, true) })
      : api<ProductDetail>(`/products/${product.id}`, { method: "PUT", body: toRequest(form, false) }),
    onSuccess: (saved) => {
      toast.success(isCreate ? t("form.toastCreated", { code: saved.units[0]?.code ?? "" }) : t("form.toastUpdated"));
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["product", saved.id] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  async function createCategory() {
    try {
      const id = await promptCreateCategory(qc, t("form.promptNewCategory"));
      if (id) set({ categoryId: id });
    } catch (e) { toast.error(errorMessage(e)); }
  }

  function submit(andNew: boolean) {
    if (!form.name.trim()) return toast.error(t("form.errors.nameRequired"));
    if (!form.categoryId) return toast.error(t("form.errors.categoryRequired"));
    if (!base.unitName.trim()) return toast.error(t("form.errors.baseUnitRequired"));
    save.mutate(undefined, {
      // "Lưu & Tạo thêm hàng": giữ nhóm hàng + thuế, xóa phần còn lại để nhập hàng kế tiếp.
      onSuccess: () => (andNew ? setForm({ ...blank(), categoryId: form.categoryId, taxRateId: form.taxRateId }) : onClose()),
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      {/* Nhãn 12px thường, ô nhập bo 6px như form KiotViet — áp cho toàn popup. */}
      <DialogContent className={"flex max-h-[92vh] flex-col gap-0 rounded-lg p-0 sm:max-w-[954px]"
        + " [&_[data-slot=label]]:text-xs [&_[data-slot=label]]:font-normal [&_input]:rounded-md"}>
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-base font-bold">{isCreate ? t("form.createTitle") : t("form.editTitle")}</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="info" className="min-h-0 flex-1 gap-0">
          <TabsList variant="line" className={`${LINE_TABS_LIST} px-5`}>
            <TabsTrigger value="info" className={LINE_TABS_TRIGGER}>{tc("detailTabs.info")}</TabsTrigger>
            <TabsTrigger value="desc" className={LINE_TABS_TRIGGER}>{tc("fields.description")}</TabsTrigger>
          </TabsList>
          <TabsContent value="info" className="space-y-4 overflow-y-auto px-5 py-3">
            <div className="grid grid-cols-1 gap-x-5 gap-y-3 md:grid-cols-2">
              <div className="grid gap-1.5"><Label>{t("fields.code")}</Label>
                <Input placeholder={t("form.auto")} value={base.code} onChange={(e) => setBase({ code: e.target.value })} /></div>
              <div className="grid gap-1.5"><Label>{t("fields.barcode")}</Label>
                <Input placeholder={t("form.barcodePlaceholder")} value={base.barcode} onChange={(e) => setBase({ barcode: e.target.value })} /></div>
              <div className="grid gap-1.5 md:col-span-2"><Label>{t("fields.name")}</Label>
                <Input placeholder={tc("status.required")} value={form.name} onChange={(e) => set({ name: e.target.value })} /></div>
              <div className="grid gap-1.5"><Label>{t("fields.einvoiceName")}</Label>
                <Input value={form.einvoiceName} onChange={(e) => set({ einvoiceName: e.target.value })} /></div>
              <div className="grid gap-1.5"><Label>{t("fields.shortName")}</Label>
                <Input value={form.shortName} onChange={(e) => set({ shortName: e.target.value })} /></div>
              <div className="grid gap-1.5 md:col-span-2">
                <div className="flex justify-between"><Label>{t("fields.category")}</Label>
                  <button type="button" className="text-xs text-primary hover:underline" onClick={createCategory}>{t("form.createNew")}</button></div>
                <NativeSelect value={form.categoryId} onChange={(e) => set({ categoryId: e.target.value })}>
                  <option value="">{t("form.pickCategoryRequired")}</option>
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
          <TabsContent value="desc" className="space-y-3 overflow-y-auto px-5 py-3">
            <div className="grid gap-1.5"><Label>{tc("fields.description")}</Label>
              <Textarea rows={6} value={form.description} onChange={(e) => set({ description: e.target.value })} /></div>
            <div className="grid gap-1.5"><Label>{tc("fields.note")}</Label>
              <Textarea rows={3} value={form.note} onChange={(e) => set({ note: e.target.value })} /></div>
          </TabsContent>
        </Tabs>
        <DialogFooter className="m-0 items-center rounded-b-lg border-t bg-background px-5 py-3 sm:justify-between">
          <div className="flex gap-4 text-[13px]">
            <label className="flex items-center gap-2">
              <Checkbox checked={base.directSale} onCheckedChange={(v) => setBase({ directSale: v === true })} /> {t("fields.directSale")}
            </label>
            <label className="flex items-center gap-2">
              <Checkbox checked={form.loyaltyPoints} onCheckedChange={(v) => set({ loyaltyPoints: v === true })} /> {t("fields.loyaltyPoints")}
            </label>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className={FOOTER_BTN} onClick={onClose}>{tc("actions.skip")}</Button>
            {isCreate && (
              <Button variant="outline" className={FOOTER_BTN} disabled={save.isPending} onClick={() => submit(true)}>
                {t("form.saveAndNew")}
              </Button>
            )}
            <Button className={`${FOOTER_BTN} min-w-16`} disabled={save.isPending} onClick={() => submit(false)}>{tc("actions.save")}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
