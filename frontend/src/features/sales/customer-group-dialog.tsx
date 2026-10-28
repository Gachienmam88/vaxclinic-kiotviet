"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { NumberInput } from "@/components/number-input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api, errorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { kvDialog, kvDialogBody, kvDialogFooter, kvDialogHeader, kvDialogTitle, kvFooterBtn, kvInput, kvLabel } from "./customer-ui-primitives";
import type { CustomerGroup, GroupDiscountType } from "./sales-types";

type Props = { group?: CustomerGroup; onClose: () => void };

/** Thêm / sửa nhóm khách hàng: tên, giảm giá (% hoặc VNĐ) tự áp dụng khi bán cho khách thuộc nhóm, ghi chú. */
export function CustomerGroupDialog({ group, onClose }: Props) {
  const qc = useQueryClient();
  const [name, setName] = useState(group?.name ?? "");
  const [type, setType] = useState<GroupDiscountType>(group?.discountType ?? "PERCENT");
  const [value, setValue] = useState(Number(group?.discountValue ?? 0));
  const [note, setNote] = useState(group?.note ?? "");

  const save = useMutation({
    mutationFn: () => {
      const body = { name, discountType: type, discountValue: value, note };
      return group ? api<CustomerGroup>(`/customer-groups/${group.id}`, { method: "PUT", body })
        : api<CustomerGroup>("/customer-groups", { method: "POST", body });
    },
    onSuccess: () => {
      toast.success(group ? "Đã cập nhật nhóm khách hàng" : "Đã thêm nhóm khách hàng");
      qc.invalidateQueries({ queryKey: ["customer-groups"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["customer"] });
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const unitBtn = (t: GroupDiscountType, label: string) => (
    <button type="button" onClick={() => setType(t)} aria-pressed={type === t}
      className={cn("h-8 min-w-12 rounded-md border px-2.5 text-[13px]", type === t ? "border-primary bg-primary font-semibold text-white" : "bg-background hover:border-primary")}>{label}</button>
  );
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={`${kvDialog} sm:max-w-[520px]`}>
        <DialogHeader className={kvDialogHeader}>
          <DialogTitle className={kvDialogTitle}>{group ? "Sửa nhóm khách hàng" : "Thêm nhóm khách hàng"}</DialogTitle>
        </DialogHeader>
        <form id="customer-group-form" className={kvDialogBody} onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <label className="block space-y-1"><span className={kvLabel}>Tên nhóm</span>
            <Input required autoFocus maxLength={100} className={kvInput} value={name} onChange={(e) => setName(e.target.value)} /></label>
          <div className="space-y-1"><span className={kvLabel}>Giảm giá</span>
            <div className="flex items-center gap-2">
              <NumberInput aria-label="Giảm giá nhóm" className={cn(kvInput, "w-40")} value={value} onValueChange={setValue} />
              {unitBtn("PERCENT", "%")}{unitBtn("AMOUNT", "VNĐ")}
            </div>
            <p className="text-xs text-muted-foreground">Tự điền vào giảm giá hóa đơn khi chọn khách thuộc nhóm ở màn bán hàng (vẫn sửa được).</p>
          </div>
          <label className="block space-y-1"><span className={kvLabel}>Ghi chú</span>
            <textarea maxLength={500} className="min-h-16 w-full rounded-md border border-[#d9dbe0] px-2.5 py-1.5 text-[13px] outline-none focus:border-primary"
              value={note} onChange={(e) => setNote(e.target.value)} /></label>
        </form>
        <DialogFooter className={kvDialogFooter}>
          <Button variant="outline" className={kvFooterBtn} onClick={onClose}>Bỏ qua</Button>
          <Button type="submit" form="customer-group-form" className={kvFooterBtn} disabled={save.isPending || !name.trim()}>Lưu</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
