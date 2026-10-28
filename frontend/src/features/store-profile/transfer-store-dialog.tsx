"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FlowFooter, FlowStepper, useVerifyStep } from "./store-flow-parts";
import { useStoreProfileMutation, useTransferCandidates, type StoreProfile } from "./store-profile-queries";

const STEPS = ["Chọn người nhận", "Xác thực"];

/**
 * "Chuyển nhượng gian hàng": chuyển quyền chủ gian hàng (đổi tên, bảo lưu, chuyển nhượng) cho 1 quản trị viên khác đang
 * hoạt động. KiotViet cần giấy tờ + OTP của 2 bên; ở đây chủ hiện tại xác thực, người nhận phải là tài khoản ADMIN sẵn có.
 */
export function TransferStoreDialog({ profile, onClose }: { profile: StoreProfile; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [target, setTarget] = useState("");
  const candidates = useTransferCandidates(true);
  const verify = useVerifyStep("TRANSFER", profile.twoFactorEnabled);
  const save = useStoreProfileMutation<{ targetUserId: string; verifyToken: string }>("POST", "/transfer", "Đã chuyển nhượng gian hàng");
  const chosen = candidates.data?.find((c) => c.id === target);

  async function submit() {
    const verifyToken = await verify.submit();
    if (verifyToken) save.mutate({ targetUserId: target, verifyToken }, { onSuccess: onClose });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-3 sm:max-w-[520px]">
        <DialogHeader><DialogTitle className="text-[17px] font-semibold">Chuyển nhượng gian hàng</DialogTitle></DialogHeader>
        <FlowStepper steps={STEPS} current={step} />
        {step === 0 ? (
          <div className="space-y-2 text-[13px]">
            <p>Sau khi chuyển nhượng, bạn không còn quyền đổi tên, bảo lưu hay chuyển nhượng gian hàng. Người nhận phải là quản trị viên đang hoạt động.</p>
            {candidates.data?.length === 0 && (
              <p className="rounded-md bg-muted px-3 py-2 text-muted-foreground">
                Chưa có quản trị viên nào khác. Tạo tài khoản vai trò Quản trị hệ thống ở Thiết lập → Quản lý người dùng trước.
              </p>
            )}
            <div role="radiogroup" className="max-h-64 space-y-1.5 overflow-y-auto">
              {candidates.data?.map((c) => (
                <label key={c.id} className="flex cursor-pointer items-center gap-2.5 rounded-md border border-border px-3 py-2 has-checked:border-primary">
                  <input type="radio" name="new-owner" className="size-4 accent-primary" checked={target === c.id} onChange={() => setTarget(c.id)} />
                  <span><b>{c.fullName}</b> <span className="text-muted-foreground">({c.username})</span></span>
                </label>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[13px]">Người nhận: <b>{chosen?.fullName}</b> ({chosen?.username})</p>
            {verify.fields}
          </div>
        )}
        <FlowFooter onCancel={onClose} nextLabel={step === 0 ? "Tiếp tục" : "Chuyển nhượng"}
          disabled={step === 0 ? !target : !verify.valid || verify.pending || save.isPending}
          onNext={() => (step === 0 ? setStep(1) : void submit())} />
      </DialogContent>
    </Dialog>
  );
}
