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
import type { Role } from "./settings-queries";

/** Nhóm quyền hiển thị — khớp Permissions.java (identity-service). */
const PERMISSION_GROUPS: { title: string; perms: [string, string][] }[] = [
  { title: "Hàng hóa & kho", perms: [["catalog.view", "Xem hàng hóa"], ["catalog.manage", "Thêm / sửa hàng hóa, nhóm hàng"],
    ["inventory.view", "Xem kho, nhập hàng"], ["inventory.manage", "Nhập hàng, trả hàng nhập, nhà cung cấp"]] },
  { title: "Bán hàng & khách hàng", perms: [["sales.perform", "Bán hàng, sửa hóa đơn, trả hàng"], ["sales.cancel", "Hủy hóa đơn, hủy phiếu trả"],
    ["patient.view", "Xem khách hàng"], ["patient.manage", "Thêm / sửa khách hàng"]] },
  { title: "Sổ quỹ & báo cáo", perms: [["cashbook.manage", "Sổ quỹ, công nợ, tài khoản ngân hàng"], ["report.view", "Xem báo cáo"]] },
  { title: "Quy trình tiêm", perms: [["reception.perform", "Tiếp đón"], ["screening.perform", "Khám sàng lọc"], ["injection.perform", "Tiêm"]] },
  { title: "Thiết lập", perms: [["user.manage", "Người dùng, vai trò, hóa đơn điện tử"], ["branch.manage", "Chi nhánh"],
    ["settings.manage", "Sửa thiết lập cửa hàng, khóa sổ"]] },
];

/** Tạo / sửa / sao chép vai trò. copyFrom: tạo vai trò mới với quyền của vai trò có sẵn. */
export function RoleFormDialog({ role, copyFrom, onClose }: { role?: Role; copyFrom?: Role; onClose: () => void }) {
  const qc = useQueryClient();
  const base = role ?? copyFrom;
  const [name, setName] = useState(role?.name ?? (copyFrom ? `${copyFrom.name} (bản sao)` : ""));
  const [description, setDescription] = useState(base?.description ?? "");
  const [perms, setPerms] = useState<string[]>(base?.permissions ?? []);
  const isAdmin = role?.code === "ADMIN";
  const save = useMutation({
    mutationFn: () => api(role ? `/roles/${role.id}` : "/roles", { method: role ? "PUT" : "POST", body: { name, description, permissions: perms } }),
    onSuccess: () => {
      toast.success(role ? "Đã cập nhật vai trò — có hiệu lực khi người dùng đăng nhập lại" : "Đã tạo vai trò");
      qc.invalidateQueries({ queryKey: ["roles"] });
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const toggle = (p: string, on: boolean) => setPerms(on ? [...perms, p] : perms.filter((x) => x !== p));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{role ? "Sửa vai trò" : "Tạo vai trò"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
          <div className="grid gap-1.5"><Label>Tên vai trò *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="grid gap-1.5"><Label>Mô tả</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        </div>
        {isAdmin && <p className="text-sm text-muted-foreground">Vai trò Quản trị luôn có toàn bộ quyền.</p>}
        <div className="space-y-3 text-sm">
          {PERMISSION_GROUPS.map((g) => (
            <div key={g.title} className="rounded-md border p-3">
              <p className="mb-2 font-medium">{g.title}</p>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {g.perms.map(([code, label]) => (
                  <label key={code} className="flex items-center gap-2">
                    <Checkbox checked={isAdmin || perms.includes(code)} disabled={isAdmin} onCheckedChange={(v) => toggle(code, v === true)} />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Bỏ qua</Button>
          <Button disabled={!name.trim() || save.isPending} onClick={() => save.mutate()}>Lưu</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
