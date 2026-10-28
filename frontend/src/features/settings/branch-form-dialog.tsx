"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, errorMessage } from "@/lib/api-client";
import type { Branch } from "./settings-queries";

type Props = { open: boolean; onOpenChange: (open: boolean) => void; branch?: Branch };

/** Thêm / sửa điểm tiêm. Mã điểm tiêm không đổi được sau khi tạo. */
export function BranchFormDialog({ open, onOpenChange, branch }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    code: branch?.code ?? "",
    name: branch?.name ?? "",
    address: branch?.address ?? "",
    phone: branch?.phone ?? "",
    active: branch?.active ?? true,
  });

  const save = useMutation({
    mutationFn: () =>
      branch
        ? api(`/branches/${branch.id}`, { method: "PUT", body: form })
        : api("/branches", { method: "POST", body: form }),
    onSuccess: () => {
      toast.success(branch ? "Đã cập nhật điểm tiêm" : "Đã thêm điểm tiêm");
      qc.invalidateQueries({ queryKey: ["branches"] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{branch ? "Sửa điểm tiêm" : "Thêm điểm tiêm"}</DialogTitle>
        </DialogHeader>
        <form id="branch-form" className="grid gap-3"
          onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <div className="grid gap-1.5">
            <Label htmlFor="b-code">Mã điểm tiêm</Label>
            <Input id="b-code" required maxLength={20} disabled={!!branch} value={form.code} onChange={set("code")} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="b-name">Tên điểm tiêm</Label>
            <Input id="b-name" required maxLength={200} value={form.name} onChange={set("name")} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="b-address">Địa chỉ</Label>
            <Input id="b-address" maxLength={500} value={form.address} onChange={set("address")} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="b-phone">Số điện thoại</Label>
            <Input id="b-phone" maxLength={20} value={form.phone} onChange={set("phone")} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={form.active} onCheckedChange={(v) => setForm((f) => ({ ...f, active: v === true }))} />
            Đang hoạt động
          </label>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Bỏ qua</Button>
          <Button type="submit" form="branch-form" disabled={save.isPending}>Lưu</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
