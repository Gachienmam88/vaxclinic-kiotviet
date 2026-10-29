"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUserLookup } from "@/features/purchases/purchase-queries";
import { useBranches } from "@/features/settings/settings-queries";
import { errorMessage } from "@/lib/api-client";
import { PriceBookFormInfoTab } from "./price-book-form-info-tab";
import { useCustomerGroupRefs, useDeletePriceBook, usePriceBooks, useSavePriceBook } from "./price-book-queries";
import { PriceBookScopePicker } from "./price-book-scope-picker";
import type { PriceBook, PriceBookRequest } from "./price-book-types";
import { LINE_TABS_LIST, LINE_TABS_TRIGGER } from "./product-tab-styles";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { productsNs } from "@/messages/products";

const FOOTER_BTN = "h-8 rounded-md px-3 font-semibold";

function initialForm(book?: PriceBook): PriceBookRequest {
  if (book) {
    const { name, validFrom, validTo, active, branchIds, customerGroupIds, sellerIds, missingPolicy, autoUpdate, autoOp,
      autoValue, autoPercent, autoBaseBookId } = book;
    // Dữ liệu cũ: chỉ bật autoUpdate = công thức theo giá chung. Bảng giá gốc đã bị xóa → chưa có công thức.
    const autoBase = book.autoBase === "BOOK" && !autoBaseBookId ? null : book.autoBase ?? (autoUpdate ? "BASE_PRICE" : null);
    return { name, validFrom, validTo, active, branchIds, customerGroupIds, sellerIds, missingPolicy, autoUpdate, autoOp,
      autoValue: Number(autoValue), autoPercent, autoBase, autoBaseBookId: autoBase === "BOOK" ? autoBaseBookId : null };
  }
  const now = new Date();
  const next = new Date(now);
  next.setFullYear(now.getFullYear() + 1);
  return {
    name: "", validFrom: now.toISOString(), validTo: next.toISOString(), active: true, branchIds: null,
    customerGroupIds: null, sellerIds: null, missingPolicy: "ALLOW", autoUpdate: false, autoOp: "PLUS", autoValue: 0,
    autoPercent: false, autoBase: null, autoBaseBookId: null,
  };
}

/** "Tạo bảng giá" / sửa bảng giá kiểu KiotViet: tab Thông tin (hiệu lực, công thức giá, thu ngân) + tab Phạm vi áp dụng. */
export function PriceBookFormDialog({ book, onClose, onSaved }: {
  book?: PriceBook; onClose: () => void; onSaved?: (b: PriceBook) => void;
}) {
  const [form, setForm] = useState(() => initialForm(book));
  const [valueText, setValueText] = useState(() => String(initialForm(book).autoValue));
  const set = (patch: Partial<PriceBookRequest>) => setForm((f) => ({ ...f, ...patch }));
  const { data: books = [] } = usePriceBooks();
  const branches = useBranches();
  const users = useUserLookup();
  const groups = useCustomerGroupRefs();
  const save = useSavePriceBook();
  const remove = useDeletePriceBook();
  const t = useT(productsNs);
  const tc = useT(commonNs);

  function submit() {
    if (!form.name.trim()) return toast.error(t("bookForm.errors.nameRequired"));
    if (Date.parse(form.validFrom) >= Date.parse(form.validTo)) return toast.error(t("bookForm.errors.dateOrder"));
    if (form.autoBase === "BOOK" && !form.autoBaseBookId) return toast.error(t("bookForm.errors.pickFormulaBook"));
    for (const [ids, msg] of [[form.branchIds, "bookForm.errors.pickBranch"], [form.customerGroupIds, "bookForm.errors.pickGroup"],
      [form.sellerIds, "bookForm.errors.pickSeller"]] as const) {
      if (ids && !ids.length) return toast.error(t(msg));
    }
    const value = Number(valueText || 0);
    if (!Number.isFinite(value) || value < 0) return toast.error(t("formula.errors.invalidValue"));
    // Tự cập nhật theo giá chung chỉ khi công thức lấy gốc là Bảng giá chung.
    const body = { ...form, autoValue: value, autoUpdate: form.autoBase === "BASE_PRICE" };
    save.mutate({ id: book?.id, body }, {
      onSuccess: (b) => { toast.success(book ? t("bookForm.toastUpdated") : t("bookForm.toastCreated", { name: b.name })); onSaved?.(b); onClose(); },
      onError: (e) => toast.error(errorMessage(e)),
    });
  }

  function del() {
    if (!book || !confirm(t("bookForm.confirmDelete", { name: book.name }))) return;
    remove.mutate(book.id, {
      onSuccess: () => { toast.success(t("bookForm.toastDeleted")); onClose(); },
      onError: (e) => toast.error(errorMessage(e)),
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 rounded-lg p-0 sm:max-w-[600px]">
        <DialogHeader className="px-5 pt-5 pb-2">
          <DialogTitle className="text-base font-bold">{book ? t("bookForm.editTitle") : t("bookForm.createTitle")}</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="info" className="min-h-0 flex-1 gap-0">
          <TabsList variant="line" className={`${LINE_TABS_LIST} px-5`}>
            <TabsTrigger value="info" className={LINE_TABS_TRIGGER}>{t("bookForm.tabInfo")}</TabsTrigger>
            <TabsTrigger value="scope" className={LINE_TABS_TRIGGER}>{t("bookForm.tabScope")}</TabsTrigger>
          </TabsList>
          <TabsContent value="info" className="overflow-y-auto px-5 py-3">
            <PriceBookFormInfoTab form={form} set={set} valueText={valueText} onValueText={setValueText} books={books} selfId={book?.id} />
          </TabsContent>
          <TabsContent value="scope" className="space-y-4 overflow-y-auto px-5 py-3">
            <PriceBookScopePicker title={tc("fields.branch")} allLabel={t("bookForm.allBranches")} specificLabel={t("bookForm.specificBranch")}
              placeholder={t("bookForm.pickBranch")} value={form.branchIds} onChange={(branchIds) => set({ branchIds })}
              options={branches.data ?? []} isLoading={branches.isLoading} error={branches.error ? errorMessage(branches.error) : null} />
            <PriceBookScopePicker title={t("bookForm.customerGroup")} allLabel={tc("status.all")} specificLabel={t("bookForm.specificGroup")}
              placeholder={t("bookForm.pickGroup")} value={form.customerGroupIds} onChange={(customerGroupIds) => set({ customerGroupIds })}
              options={groups.data ?? []} isLoading={groups.isLoading} error={groups.error ? errorMessage(groups.error) : null} />
            <PriceBookScopePicker title={t("bookForm.seller")} allLabel={tc("status.all")} specificLabel={t("bookForm.specificSeller")}
              placeholder={t("bookForm.pickSeller")} value={form.sellerIds} onChange={(sellerIds) => set({ sellerIds })}
              options={(users.data ?? []).map((u) => ({ id: u.id, name: u.fullName }))} isLoading={users.isLoading}
              error={users.error ? errorMessage(users.error) : null} />
          </TabsContent>
        </Tabs>
        <DialogFooter className="m-0 items-center rounded-b-lg border-t bg-background px-5 py-3 sm:justify-between">
          <div>{book && <Button variant="destructive" className={FOOTER_BTN} disabled={remove.isPending} onClick={del}>{tc("actions.delete")}</Button>}</div>
          <div className="flex gap-2">
            <Button variant="outline" className={FOOTER_BTN} onClick={onClose}>{tc("actions.skip")}</Button>
            <Button className={`${FOOTER_BTN} min-w-16`} disabled={save.isPending} onClick={submit}>{tc("actions.save")}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
