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
import { MISSING_POLICY_LABEL, type MissingPolicy, type PriceBook, type PriceBookRequest } from "./price-book-types";

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

  function submit() {
    if (!form.name.trim()) return toast.error("Nhập tên bảng giá");
    if (Date.parse(form.validFrom) >= Date.parse(form.validTo)) return toast.error("Ngày hiệu lực đến phải sau ngày hiệu lực từ");
    for (const [ids, label] of [[form.branchIds, "chi nhánh"], [form.customerGroupIds, "nhóm khách hàng"],
      [form.sellerIds, "người tạo giao dịch"]] as const) {
      if (ids && !ids.length) return toast.error(`Chọn ít nhất 1 ${label} hoặc chọn Tất cả`);
    }
    save.mutate({ id: book?.id, body: form }, {
      onSuccess: (b) => { toast.success(book ? "Đã cập nhật bảng giá" : `Đã tạo bảng giá ${b.name}`); onSaved?.(b); onClose(); },
      onError: (e) => toast.error(errorMessage(e)),
    });
  }

  function del() {
    if (!book || !confirm(`Xóa bảng giá "${book.name}"? Toàn bộ giá trong bảng sẽ bị xóa.`)) return;
    remove.mutate(book.id, {
      onSuccess: () => { toast.success("Đã xóa bảng giá"); onClose(); },
      onError: (e) => toast.error(errorMessage(e)),
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={"flex max-h-[92vh] flex-col gap-0 rounded-lg p-0 sm:max-w-[720px]"
        + " [&_[data-slot=label]]:text-xs [&_[data-slot=label]]:font-semibold [&_input]:rounded-md"}>
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-base font-bold">{book ? "Sửa bảng giá" : "Thêm bảng giá"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 overflow-y-auto px-5 pb-4 md:grid-cols-2">
          <div className="grid gap-1.5 md:col-span-2"><Label>Tên bảng giá</Label>
            <Input autoFocus placeholder="Bắt buộc" value={form.name} onChange={(e) => set({ name: e.target.value })} /></div>
          <div className="grid gap-1.5"><Label>Hiệu lực từ</Label>
            <Input type="date" value={day(new Date(form.validFrom))}
              onChange={(e) => e.target.value && set({ validFrom: new Date(`${e.target.value}T00:00:00`).toISOString() })} /></div>
          <div className="grid gap-1.5"><Label>Đến</Label>
            <Input type="date" value={day(new Date(form.validTo))}
              onChange={(e) => e.target.value && set({ validTo: new Date(`${e.target.value}T23:59:59`).toISOString() })} /></div>
          <div className="grid gap-1.5 md:col-span-2"><Label>Trạng thái</Label>
            <div className="flex gap-4 text-[13px]">
              {[true, false].map((on) => (
                <label key={String(on)} className="flex items-center gap-1.5">
                  <input type="radio" name="pb-active" className="size-4 accent-primary" checked={form.active === on}
                    onChange={() => set({ active: on })} /> {on ? "Áp dụng" : "Chưa áp dụng"}
                </label>
              ))}
            </div>
          </div>
          <PriceBookScopePicker label="Chi nhánh" placeholder="Chọn chi nhánh" value={form.branchIds}
            onChange={(branchIds) => set({ branchIds })} options={branches.data ?? []} isLoading={branches.isLoading}
            error={branches.error ? errorMessage(branches.error) : null} />
          <PriceBookScopePicker label="Nhóm khách hàng" placeholder="Chọn nhóm khách hàng" value={form.customerGroupIds}
            onChange={(customerGroupIds) => set({ customerGroupIds })} options={groups.data ?? []} isLoading={groups.isLoading}
            error={groups.error ? errorMessage(groups.error) : null} />
          <PriceBookScopePicker label="Người tạo giao dịch" placeholder="Chọn người tạo giao dịch" value={form.sellerIds}
            onChange={(sellerIds) => set({ sellerIds })} isLoading={users.isLoading}
            options={(users.data ?? []).map((u) => ({ id: u.id, name: u.fullName }))}
            error={users.error ? errorMessage(users.error) : null} />
          <div className="grid gap-1.5"><Label>Khi thêm hàng không có trong bảng giá</Label>
            <NativeSelect value={form.missingPolicy} onChange={(e) => set({ missingPolicy: e.target.value as MissingPolicy })}>
              {(Object.keys(MISSING_POLICY_LABEL) as MissingPolicy[]).map((k) => <option key={k} value={k}>{MISSING_POLICY_LABEL[k]}</option>)}
            </NativeSelect></div>
          <div className="grid gap-2 md:col-span-2">
            <label className="flex items-center gap-2 text-[13px]">
              <Checkbox checked={form.autoUpdate} onCheckedChange={(v) => set({ autoUpdate: v === true })} />
              Tự động cập nhật giá khi giá chung thay đổi
            </label>
            {form.autoUpdate && (
              <div className="flex items-center gap-2 pl-6 text-[13px]">
                <span>Giá bán = Giá chung</span>
                <div className="w-16"><NativeSelect aria-label="Phép tính" value={form.autoOp}
                  onChange={(e) => set({ autoOp: e.target.value as "PLUS" | "MINUS" })}>
                  <option value="PLUS">+</option><option value="MINUS">−</option>
                </NativeSelect></div>
                <Input aria-label="Giá trị" type="number" min={0} className="h-8 w-28 text-right" value={form.autoValue}
                  onChange={(e) => set({ autoValue: Math.max(0, Number(e.target.value)) })} />
                <div className="w-20"><NativeSelect aria-label="Đơn vị" value={form.autoPercent ? "%" : "VND"}
                  onChange={(e) => set({ autoPercent: e.target.value === "%" })}>
                  <option value="VND">VNĐ</option><option value="%">%</option>
                </NativeSelect></div>
              </div>
            )}
          </div>
        </div>
        <DialogFooter className="m-0 items-center rounded-b-lg border-t bg-background px-5 py-3 sm:justify-between">
          <div>{book && <Button variant="destructive" className={FOOTER_BTN} disabled={remove.isPending} onClick={del}>Xóa</Button>}</div>
          <div className="flex gap-2">
            <Button variant="outline" className={FOOTER_BTN} onClick={onClose}>Bỏ qua</Button>
            <Button className={`${FOOTER_BTN} min-w-16`} disabled={save.isPending} onClick={submit}>Lưu</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
