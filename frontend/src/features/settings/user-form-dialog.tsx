"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, errorMessage } from "@/lib/api-client";
import { useCurrentUser, type User } from "@/lib/use-current-user";
import { ResetTwoFactorDialog } from "./reset-two-factor-dialog";
import { useBranches, useRoles } from "./settings-queries";

type Props = { open: boolean; onOpenChange: (open: boolean) => void; user?: User };

/** Thêm / sửa người dùng: vai trò + các điểm tiêm được làm việc; đặt lại mật khẩu / xác thực 2 lớp khi sửa. */
export function UserFormDialog({ open, onOpenChange, user }: Props) {
  const qc = useQueryClient();
  const { data: me } = useCurrentUser();
  const [resetting2fa, setResetting2fa] = useState(false);
  // Không tự đặt lại cho mình (Tài khoản → Xác thực 2 lớp); 2FA của chủ gian hàng chỉ chủ gian hàng tự xử lý.
  const canReset2fa = !!user?.twoFactorEnabled && !user.owner && user.id !== me?.user.id;
  const { data: roles = [] } = useRoles();
  const { data: branches = [] } = useBranches();
  const [form, setForm] = useState({
    username: user?.username ?? "",
    password: "",
    fullName: user?.fullName ?? "",
    phone: user?.phone ?? "",
    roleId: user?.roleId ?? "",
    branchIds: user?.branches.map((b) => b.id) ?? [],
    active: user?.active ?? true,
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!user) return api("/users", { method: "POST", body: form });
      const { fullName, phone, roleId, branchIds, active, password } = form;
      await api(`/users/${user.id}`, { method: "PUT", body: { fullName, phone, roleId, branchIds, active } });
      if (password) await api(`/users/${user.id}/reset-password`, { method: "POST", body: { password } });
    },
    onSuccess: () => {
      toast.success(user ? "Đã cập nhật người dùng" : "Đã thêm người dùng");
      qc.invalidateQueries({ queryKey: ["users"] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const set = (key: "username" | "password" | "fullName" | "phone") =>
    (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const toggleBranch = (id: string, checked: boolean) =>
    setForm((f) => ({ ...f, branchIds: checked ? [...f.branchIds, id] : f.branchIds.filter((b) => b !== id) }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{user ? "Sửa người dùng" : "Thêm người dùng"}</DialogTitle>
        </DialogHeader>
        <form id="user-form" className="grid grid-cols-2 gap-3"
          onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <div className="grid gap-1.5">
            <Label htmlFor="u-username">Tên đăng nhập</Label>
            <Input id="u-username" required disabled={!!user} value={form.username} onChange={set("username")} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="u-password">{user ? "Mật khẩu mới (bỏ trống nếu giữ)" : "Mật khẩu"}</Label>
            <Input id="u-password" type="password" required={!user} minLength={8} autoComplete="new-password"
              value={form.password} onChange={set("password")} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="u-fullname">Họ tên</Label>
            <Input id="u-fullname" required value={form.fullName} onChange={set("fullName")} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="u-phone">Điện thoại</Label>
            <Input id="u-phone" value={form.phone} onChange={set("phone")} />
          </div>
          <div className="col-span-2 grid gap-1.5">
            <Label>Vai trò</Label>
            <Select value={form.roleId || null}
              items={roles.map((r) => ({ value: r.id, label: r.name }))}
              onValueChange={(v) => setForm((f) => ({ ...f, roleId: v ?? "" }))}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Chọn vai trò" /></SelectTrigger>
              <SelectContent>
                {roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 grid gap-1.5">
            <Label>Chi nhánh được làm việc</Label>
            <div className="grid grid-cols-2 gap-2 rounded-md border p-2">
              {branches.map((b) => (
                <label key={b.id} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={form.branchIds.includes(b.id)}
                    onCheckedChange={(v) => toggleBranch(b.id, v === true)} />
                  {b.name}
                </label>
              ))}
            </div>
          </div>
          {user && (
            <label className="col-span-2 flex items-center gap-2 text-sm">
              <Checkbox checked={form.active} onCheckedChange={(v) => setForm((f) => ({ ...f, active: v === true }))} />
              Đang hoạt động (bỏ chọn để khóa tài khoản)
            </label>
          )}
        </form>
        <DialogFooter>
          {canReset2fa && (
            <Button variant="ghost" className="mr-auto text-primary" onClick={() => setResetting2fa(true)}>Đặt lại xác thực 2 lớp</Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Bỏ qua</Button>
          <Button type="submit" form="user-form" disabled={save.isPending || !form.roleId}>Lưu</Button>
        </DialogFooter>
        {resetting2fa && user && (
          <ResetTwoFactorDialog user={user} onOpenChange={setResetting2fa} onDone={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}
