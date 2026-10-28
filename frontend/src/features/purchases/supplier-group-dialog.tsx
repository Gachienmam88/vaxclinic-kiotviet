"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { kvDialog, kvDialogFooter, kvDialogHeader, kvDialogTitle, kvFooterBtn, kvInput, kvLabel } from "@/features/sales/customer-ui-primitives";
import { api, errorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { SupplierConfirmDialog } from "./supplier-confirm-dialog";
import { useInvalidateSuppliers } from "./supplier-queries";
import type { SupplierGroup } from "./supplier-types";

/** Tạo / sửa / xóa nhóm nhà cung cấp (link "Tạo mới" và nút sửa cạnh ô chọn nhóm ở sidebar). */
export function SupplierGroupDialog({ group, onClose, onSaved }: { group?: SupplierGroup; onClose: () => void; onSaved?: (g: SupplierGroup | null) => void }) {
  const invalidate = useInvalidateSuppliers();
  const [name, setName] = useState(group?.name ?? "");
  const [note, setNote] = useState(group?.note ?? "");
  const [confirm, setConfirm] = useState(false);
  const save = useMutation({
    mutationFn: () => group
      ? api<SupplierGroup>(`/suppliers/groups/${group.id}`, { method: "PUT", body: { name, note } })
      : api<SupplierGroup>("/suppliers/groups", { method: "POST", body: { name, note } }),
    onSuccess: (g) => { toast.success(group ? "Đã cập nhật nhóm" : `Đã tạo nhóm ${g.name}`); invalidate(); onSaved?.(g); onClose(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: () => api(`/suppliers/groups/${group?.id}`, { method: "DELETE" }),
    onSuccess: () => { toast.success("Đã xóa nhóm"); invalidate(); onSaved?.(null); onClose(); },
    onError: (e) => { setConfirm(false); toast.error(errorMessage(e)); },
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={cn(kvDialog, "sm:max-w-[480px]")}>
        <DialogHeader className={kvDialogHeader}><DialogTitle className={kvDialogTitle}>{group ? "Sửa nhóm nhà cung cấp" : "Tạo nhóm nhà cung cấp"}</DialogTitle></DialogHeader>
        <form id="supplier-group-form" className="grid gap-3 px-5 pb-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <div className="grid gap-1.5"><Label htmlFor="sg-name" className={kvLabel}>Tên nhóm</Label>
            <Input id="sg-name" autoFocus required placeholder="Bắt buộc" className={kvInput} value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="grid gap-1.5"><Label htmlFor="sg-note" className={kvLabel}>Ghi chú</Label>
            <textarea id="sg-note" placeholder="Nhập ghi chú" value={note} onChange={(e) => setNote(e.target.value)}
              className="min-h-[58px] rounded-md border border-[#d9dbe0] px-2.5 py-1.5 text-[13px] outline-none focus:border-primary" /></div>
          {group && <p className="text-[12px] text-muted-foreground">{group.supplierCount} nhà cung cấp trong nhóm</p>}
        </form>
        <DialogFooter className={cn(kvDialogFooter, "sm:justify-between")}>
          {group ? <Button variant="ghost" className={cn(kvFooterBtn, "px-2")} onClick={() => setConfirm(true)}><Trash2 className="size-4" /> Xóa</Button> : <span />}
          <div className="flex gap-2">
            <Button variant="outline" className={kvFooterBtn} onClick={onClose}>Bỏ qua</Button>
            <Button type="submit" form="supplier-group-form" className={kvFooterBtn} disabled={save.isPending || !name.trim()}>Lưu</Button>
          </div>
        </DialogFooter>
      </DialogContent>
      {confirm && <SupplierConfirmDialog pending={remove.isPending} onClose={() => setConfirm(false)} onConfirm={() => remove.mutate()}
        message={`Bạn có chắc chắn muốn xóa nhóm "${group?.name}"? Các nhà cung cấp trong nhóm sẽ chuyển về chưa có nhóm.`} />}
    </Dialog>
  );
}
