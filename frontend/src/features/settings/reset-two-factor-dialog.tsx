"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, errorMessage } from "@/lib/api-client";
import { useCurrentUser, type User } from "@/lib/use-current-user";

type Props = { user: User; onOpenChange: (open: boolean) => void; onDone: () => void };

/**
 * Đặt lại xác thực 2 lớp cho người dùng khác (mất điện thoại + mã khôi phục): POST /users/{id}/2fa/reset.
 * Người thao tác xác nhận bằng mật khẩu của mình, hoặc mã Authenticator nếu chính họ đã bật 2 lớp.
 */
export function ResetTwoFactorDialog({ user, onOpenChange, onDone }: Props) {
  const qc = useQueryClient();
  const { data: me } = useCurrentUser();
  const useCode = !!me?.twoFactorEnabled;
  const [secret, setSecret] = useState("");

  const reset = useMutation({
    mutationFn: () => api(`/users/${user.id}/2fa/reset`, {
      method: "POST", body: useCode ? { code: secret.trim() } : { password: secret },
    }),
    onSuccess: () => {
      toast.success(`Đã đặt lại xác thực 2 lớp cho ${user.fullName}`);
      qc.invalidateQueries({ queryKey: ["users"] });
      onDone();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Đặt lại xác thực 2 lớp</DialogTitle>
          <DialogDescription>
            Tài khoản {user.username} sẽ tắt xác thực 2 lớp, mất toàn bộ mã khôi phục và bị đăng xuất khỏi mọi thiết bị.
            Người dùng cần bật lại xác thực 2 lớp sau khi đăng nhập.
          </DialogDescription>
        </DialogHeader>
        <form id="reset-2fa-form" className="grid gap-1.5" onSubmit={(e) => { e.preventDefault(); reset.mutate(); }}>
          <Label htmlFor="reset-2fa-secret">
            {useCode ? "Mã xác thực 2 lớp của bạn" : "Mật khẩu đăng nhập của bạn"}
          </Label>
          <Input id="reset-2fa-secret" required autoFocus
            type={useCode ? "text" : "password"} inputMode={useCode ? "numeric" : undefined}
            autoComplete={useCode ? "one-time-code" : "current-password"}
            value={secret} onChange={(e) => setSecret(e.target.value)} />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Bỏ qua</Button>
          <Button type="submit" form="reset-2fa-form" disabled={reset.isPending || !secret.trim()}>Đặt lại</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
