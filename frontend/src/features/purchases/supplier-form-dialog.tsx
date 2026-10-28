"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormSection } from "@/features/products/product-form-sections";
import { api, errorMessage } from "@/lib/api-client";
import { useSupplierGroups } from "./purchase-queries";
import type { Supplier } from "./purchase-types";

type Props = { supplier?: Supplier; onClose: () => void; onSaved?: (s: Supplier) => void };

const FIELDS = ["name", "code", "phone", "email", "address", "province", "ward", "groupName", "note",
  "companyName", "taxCode", "idNumber"] as const;
type Form = Record<(typeof FIELDS)[number], string>;

/** Tạo / sửa nhà cung cấp: thông tin chính, địa chỉ, nhóm + ghi chú, thông tin xuất hóa đơn. */
export function SupplierFormDialog({ supplier, onClose, onSaved }: Props) {
  const qc = useQueryClient();
  const { data: groups = [] } = useSupplierGroups();
  const [form, setForm] = useState<Form>(() =>
    Object.fromEntries(FIELDS.map((f) => [f, supplier?.[f] ?? ""])) as Form);
  const bind = (key: keyof Form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  const save = useMutation({
    mutationFn: () => supplier
      ? api<Supplier>(`/suppliers/${supplier.id}`, { method: "PUT", body: form })
      : api<Supplier>("/suppliers", { method: "POST", body: form }),
    onSuccess: (s) => {
      toast.success(supplier ? "Đã cập nhật nhà cung cấp" : `Đã tạo nhà cung cấp ${s.code}`);
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      qc.invalidateQueries({ queryKey: ["supplier-groups"] });
      onSaved?.(s);
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[92vh] flex-col sm:max-w-3xl">
        <DialogHeader><DialogTitle>{supplier ? "Sửa nhà cung cấp" : "Tạo nhà cung cấp"}</DialogTitle></DialogHeader>
        <form id="supplier-form" className="space-y-3 overflow-y-auto pr-1"
          onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="grid gap-1.5"><Label>Tên nhà cung cấp</Label><Input required placeholder="Bắt buộc" {...bind("name")} /></div>
            <div className="grid gap-1.5"><Label>Mã nhà cung cấp</Label><Input placeholder="Tự động" {...bind("code")} /></div>
            <div className="grid gap-1.5"><Label>Điện thoại</Label><Input {...bind("phone")} /></div>
            <div className="grid gap-1.5"><Label>Email</Label><Input type="email" placeholder="email@gmail.com" {...bind("email")} /></div>
          </div>
          <FormSection title="Địa chỉ">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="grid gap-1.5 md:col-span-2"><Label>Địa chỉ</Label><Input placeholder="Nhập địa chỉ" {...bind("address")} /></div>
              <div className="grid gap-1.5"><Label>Khu vực</Label><Input placeholder="Tỉnh/Thành phố" {...bind("province")} /></div>
              <div className="grid gap-1.5"><Label>Phường/Xã</Label><Input placeholder="Phường/Xã" {...bind("ward")} /></div>
            </div>
          </FormSection>
          <FormSection title="Nhóm nhà cung cấp, ghi chú">
            <div className="grid gap-3">
              <div className="grid gap-1.5"><Label>Nhóm nhà cung cấp</Label>
                <Input list="supplier-groups" placeholder="Chọn hoặc gõ nhóm mới" {...bind("groupName")} />
                <datalist id="supplier-groups">{groups.map((g) => <option key={g} value={g} />)}</datalist>
              </div>
              <div className="grid gap-1.5"><Label>Ghi chú</Label><Textarea placeholder="Nhập ghi chú" {...bind("note")} /></div>
            </div>
          </FormSection>
          <FormSection title="Thông tin xuất hóa đơn">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="grid gap-1.5"><Label>Tên công ty</Label><Input {...bind("companyName")} /></div>
              <div className="grid gap-1.5"><Label>Mã số thuế</Label><Input {...bind("taxCode")} /></div>
              <div className="grid gap-1.5"><Label>Số CCCD/CMND</Label><Input {...bind("idNumber")} /></div>
            </div>
          </FormSection>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Bỏ qua</Button>
          <Button type="submit" form="supplier-form" disabled={save.isPending}>Lưu</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
