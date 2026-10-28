"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUserLookup } from "@/features/purchases/purchase-queries";
import { useBranches } from "@/features/settings/settings-queries";
import { errorMessage } from "@/lib/api-client";
import { NativeSelect } from "./product-form-sections";
import { useCustomerGroupRefs, useDeletePriceBook, useSavePriceBook } from "./price-book-queries";
import { PriceBookScopePicker } from "./price-book-scope-picker";
import { MISSING_POLICIES, type MissingPolicy, type PriceBook, type PriceBookRequest } from "./price-book-types";
import { DatePicker } from "@/components/ui/date-picker";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { productsNs } from "@/messages/products";

const FOOTER_BTN = "h-8 rounded-md px-3 font-semibold";
const day = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function initialForm(book?: PriceBook): PriceBookRequest {
  if (book) {
    const { name, validFrom, validTo, active, branchIds, customerGroupIds, sellerIds, missingPolicy, autoUpdate, autoOp,
      autoValue, autoPercent } = book;
    return { name, validFrom, validTo, active, branchIds, customerGroupIds, sellerIds, missingPolicy, autoUpdate, autoOp,
      autoValue: Number(autoValue), autoPercent };
  }
  const now = new Date();
  const next = new Date(now);
  next.setFullYear(now.getFullYear() + 1);
  return {
    name: "", validFrom: now.toISOString(), validTo: next.toISOString(), active: true, branchIds: null,
    customerGroupIds: null, sellerIds: null, missingPolicy: "ALLOW", autoUpdate: false, autoOp: "PLUS", autoValue: 0,
    autoPercent: false,
  };
}

/** "Thêm bảng giá" / sửa bảng giá: tên, hiệu lực, trạng thái, phạm vi áp dụng, chính sách hàng ngoài bảng giá. */
export function PriceBookFormDialog({ book, onClose, onSaved }: {
  book?: PriceBook; onClose: () => void; onSaved?: (b: PriceBook) => void;
}) {
  const [form, setForm] = useState(() => initialForm(book));
  const set = (patch: Partial<PriceBookRequest>) => setForm((f) => ({ ...f, ...patch }));
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
    for (const [ids, msg] of [[form.branchIds, "bookForm.errors.pickBranch"], [form.customerGroupIds, "bookForm.errors.pickGroup"],
      [form.sellerIds, "bookForm.errors.pickSeller"]] as const) {
      if (ids && !ids.length) return toast.error(t(msg));
    }
    save.mutate({ id: book?.id, body: form }, {
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
      <DialogContent className={"flex max-h-[92vh] flex-col gap-0 rounded-lg p-0 sm:max-w-[720px]"
        + " [&_[data-slot=label]]:text-xs [&_[data-slot=label]]:font-semibold [&_input]:rounded-md"}>
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-base font-bold">{book ? t("bookForm.editTitle") : t("bookForm.createTitle")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 overflow-y-auto px-5 pb-4 md:grid-cols-2">
          <div className="grid gap-1.5 md:col-span-2"><Label>{t("bookForm.name")}</Label>
            <Input autoFocus placeholder={tc("status.required")} value={form.name} onChange={(e) => set({ name: e.target.value })} /></div>
          <div className="grid gap-1.5"><Label>{t("bookForm.validFrom")}</Label>
            <DatePicker value={day(new Date(form.validFrom))}
              onChange={(v) => v && set({ validFrom: new Date(`${v}T00:00:00`).toISOString() })} /></div>
          <div className="grid gap-1.5"><Label>{t("bookForm.validTo")}</Label>
            <DatePicker value={day(new Date(form.validTo))}
              onChange={(v) => v && set({ validTo: new Date(`${v}T23:59:59`).toISOString() })} /></div>
          <div className="grid gap-1.5 md:col-span-2"><Label>{tc("fields.status")}</Label>
            <div className="flex gap-4 text-[13px]">
              {[true, false].map((on) => (
                <label key={String(on)} className="flex items-center gap-1.5">
                  <input type="radio" name="pb-active" className="size-4 accent-primary" checked={form.active === on}
                    onChange={() => set({ active: on })} /> {on ? t("bookForm.applied") : t("bookForm.notApplied")}
                </label>
              ))}
            </div>
          </div>
          <PriceBookScopePicker label={tc("fields.branch")} placeholder={t("bookForm.pickBranch")} value={form.branchIds}
            onChange={(branchIds) => set({ branchIds })} options={branches.data ?? []} isLoading={branches.isLoading}
            error={branches.error ? errorMessage(branches.error) : null} />
          <PriceBookScopePicker label={t("bookForm.customerGroup")} placeholder={t("bookForm.pickGroup")} value={form.customerGroupIds}
            onChange={(customerGroupIds) => set({ customerGroupIds })} options={groups.data ?? []} isLoading={groups.isLoading}
            error={groups.error ? errorMessage(groups.error) : null} />
          <PriceBookScopePicker label={t("bookForm.seller")} placeholder={t("bookForm.pickSeller")} value={form.sellerIds}
            onChange={(sellerIds) => set({ sellerIds })} isLoading={users.isLoading}
            options={(users.data ?? []).map((u) => ({ id: u.id, name: u.fullName }))}
            error={users.error ? errorMessage(users.error) : null} />
          <div className="grid gap-1.5"><Label>{t("bookForm.missingPolicy")}</Label>
            <NativeSelect value={form.missingPolicy} onChange={(e) => set({ missingPolicy: e.target.value as MissingPolicy })}>
              {MISSING_POLICIES.map((k) => <option key={k} value={k}>{t(`missingPolicy.${k}`)}</option>)}
            </NativeSelect></div>
          <div className="grid gap-2 md:col-span-2">
            <label className="flex items-center gap-2 text-[13px]">
              <Checkbox checked={form.autoUpdate} onCheckedChange={(v) => set({ autoUpdate: v === true })} />
              {t("bookForm.autoUpdate")}
            </label>
            {form.autoUpdate && (
              <div className="flex items-center gap-2 pl-6 text-[13px]">
                <span>{t("bookForm.autoFormula")}</span>
                <div className="w-16"><NativeSelect aria-label={t("formula.operator")} value={form.autoOp}
                  onChange={(e) => set({ autoOp: e.target.value as "PLUS" | "MINUS" })}>
                  <option value="PLUS">+</option><option value="MINUS">−</option>
                </NativeSelect></div>
                <Input aria-label={t("formula.value")} type="number" min={0} className="h-8 w-28 text-right" value={form.autoValue}
                  onChange={(e) => set({ autoValue: Math.max(0, Number(e.target.value)) })} />
                <div className="w-20"><NativeSelect aria-label={t("formula.unit")} value={form.autoPercent ? "%" : "VND"}
                  onChange={(e) => set({ autoPercent: e.target.value === "%" })}>
                  <option value="VND">VNĐ</option><option value="%">%</option>
                </NativeSelect></div>
              </div>
            )}
          </div>
        </div>
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
