"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toVnAddress, VnAddressFields, type VnAddress } from "@/components/ui/vn-address-fields";
import { FormSection, NativeSelect } from "@/features/products/product-form-sections";
import { api, errorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { Supplier } from "./purchase-types";
import { useInvalidateSuppliers, useSupplierGroups } from "./supplier-queries";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { purchasesNs } from "@/messages/purchases";

type Props = { supplier?: Supplier; onClose: () => void; onSaved?: (s: Supplier) => void };

const FIELDS = ["name", "code", "phone", "email", "groupId", "note",
  "companyName", "taxCode", "idNumber"] as const;
type Form = Record<(typeof FIELDS)[number], string>;

/** Tạo / sửa nhà cung cấp (KiotViet): thông tin chính, Địa chỉ, Nhóm NCC + ghi chú, Thông tin xuất hóa đơn (khối thu gọn được). */
export function SupplierFormDialog({ supplier, onClose, onSaved }: Props) {
  const invalidate = useInvalidateSuppliers();
  const { data: groups = [] } = useSupplierGroups();
  const t = useT(purchasesNs);
  const tc = useT(commonNs);
  const [form, setForm] = useState<Form>(() =>
    Object.fromEntries(FIELDS.map((f) => [f, supplier?.[f] ?? ""])) as Form);
  const [addr, setAddr] = useState<VnAddress>(() => toVnAddress(supplier?.address, supplier?.provinceCode, supplier?.province,
    supplier?.wardCode, supplier?.ward));
  const bind = (key: keyof Form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  const body = () => ({ ...form, groupId: form.groupId || null, address: addr.address, province: addr.provinceName,
    ward: addr.wardName, provinceCode: addr.provinceCode || null, wardCode: addr.wardCode || null });
  const save = useMutation({
    mutationFn: () => supplier
      ? api<Supplier>(`/suppliers/${supplier.id}`, { method: "PUT", body: body() })
      : api<Supplier>("/suppliers", { method: "POST", body: body() }),
    onSuccess: (s) => {
      toast.success(supplier ? t("suppliers.form.toastUpdated") : t("suppliers.form.toastCreated", { code: s.code }));
      invalidate();
      onSaved?.(s);
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const field = (key: keyof Form, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className={cn("grid gap-1", props.className)}>
      <Label htmlFor={`supplier-${key}`} className="text-xs font-normal">{label}</Label>
      <Input id={`supplier-${key}`} {...props} className="h-8 rounded-md" {...bind(key)} />
    </div>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 rounded-lg p-0 sm:max-w-[870px]">
        <DialogHeader className="px-4 pt-4 pb-3">
          <DialogTitle className="text-base font-bold">{supplier ? t("suppliers.form.titleEdit") : t("suppliers.form.titleCreate")}</DialogTitle>
        </DialogHeader>
        <form id="supplier-form" className="space-y-3 overflow-y-auto px-4 pb-4"
          onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <div className="grid grid-cols-1 gap-x-5 gap-y-2.5 md:grid-cols-2">
            {field("name", t("suppliers.cols.name"), { required: true, placeholder: tc("status.required") })}
            {field("code", t("suppliers.cols.code"), { placeholder: t("suppliers.form.auto") })}
            {field("phone", tc("fields.phone"))}
            {field("email", tc("fields.email"), { type: "email", placeholder: "email@gmail.com" })}
          </div>
          <FormSection title={tc("fields.address")}>
            <div className="grid grid-cols-1 gap-x-5 gap-y-2.5 md:grid-cols-2">
              <VnAddressFields value={addr} onChange={setAddr} idPrefix="supplier" addressPlaceholder={t("suppliers.form.addressPlaceholder")}
                addressFieldClassName="md:col-span-2" labelClassName="text-xs font-normal" />
            </div>
          </FormSection>
          <FormSection title={t("suppliers.form.groupNote")}>
            <div className="grid gap-2.5">
              <div className="grid gap-1"><Label htmlFor="supplier-groupId" className="text-xs font-normal">{t("suppliers.cols.group")}</Label>
                <NativeSelect id="supplier-groupId" {...bind("groupId")}>
                  <option value="">{t("suppliers.form.pickGroup")}</option>
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </NativeSelect></div>
              <div className="grid gap-1"><Label htmlFor="supplier-note" className="text-xs font-normal">{tc("fields.note")}</Label>
                <Textarea id="supplier-note" className="min-h-[58px] rounded-md" placeholder={t("suppliers.form.notePlaceholder")} {...bind("note")} /></div>
            </div>
          </FormSection>
          <FormSection title={t("suppliers.info.billing")}>
            <div className="grid grid-cols-1 gap-x-5 gap-y-2.5 md:grid-cols-2">
              {field("companyName", t("suppliers.form.companyName"), { placeholder: t("suppliers.form.companyPlaceholder") })}
              {field("taxCode", t("suppliers.cols.taxCode"), { placeholder: t("suppliers.form.taxCodePlaceholder") })}
              {field("idNumber", t("suppliers.form.idNumber"), { placeholder: t("suppliers.form.idNumberPlaceholder") })}
            </div>
          </FormSection>
        </form>
        <div className="flex justify-end gap-2 border-t border-[#e5e7eb] px-4 py-3">
          <Button variant="outline" className="h-8 rounded-md border-[#d1d5db] px-3" onClick={onClose}>{tc("actions.skip")}</Button>
          <Button type="submit" form="supplier-form" className="h-8 rounded-md px-4" disabled={save.isPending}>{tc("actions.save")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
