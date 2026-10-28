"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useT } from "@/lib/i18n";
import { storeProfileNs } from "@/messages/store-profile";
import { FlowFooter, FlowStepper, useVerifyStep } from "./store-flow-parts";
import { useStoreProfileMutation, useTransferCandidates, type StoreProfile } from "./store-profile-queries";

/**
 * "Chuyển nhượng gian hàng": chuyển quyền chủ gian hàng (đổi tên, bảo lưu, chuyển nhượng) cho 1 quản trị viên khác đang
 * hoạt động. KiotViet cần giấy tờ + OTP của 2 bên; ở đây chủ hiện tại xác thực, người nhận phải là tài khoản ADMIN sẵn có.
 */
export function TransferStoreDialog({ profile, onClose }: { profile: StoreProfile; onClose: () => void }) {
  const t = useT(storeProfileNs);
  const [step, setStep] = useState(0);
  const [target, setTarget] = useState("");
  const candidates = useTransferCandidates(true);
  const verify = useVerifyStep("TRANSFER", profile.twoFactorEnabled);
  const save = useStoreProfileMutation<{ targetUserId: string; verifyToken: string }>("POST", "/transfer", t("transfer.toast"));
  const chosen = candidates.data?.find((c) => c.id === target);

  async function submit() {
    const verifyToken = await verify.submit();
    if (verifyToken) save.mutate({ targetUserId: target, verifyToken }, { onSuccess: onClose });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-3 sm:max-w-[520px]">
        <DialogHeader><DialogTitle className="text-[17px] font-semibold">{t("transfer.title")}</DialogTitle></DialogHeader>
        <FlowStepper steps={[t("transfer.steps.pickRecipient"), t("transfer.steps.verify")]} current={step} />
        {step === 0 ? (
          <div className="space-y-2 text-[13px]">
            <p>{t("transfer.intro")}</p>
            {candidates.data?.length === 0 && (
              <p className="rounded-md bg-muted px-3 py-2 text-muted-foreground">
                {t("transfer.noCandidates")}
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
            <p className="text-[13px]">{t("transfer.recipient")} <b>{chosen?.fullName}</b> ({chosen?.username})</p>
            {verify.fields}
          </div>
        )}
        <FlowFooter onCancel={onClose} nextLabel={step === 0 ? t("flow.next") : t("transfer.submit")}
          disabled={step === 0 ? !target : !verify.valid || verify.pending || save.isPending}
          onNext={() => (step === 0 ? setStep(1) : void submit())} />
      </DialogContent>
    </Dialog>
  );
}
