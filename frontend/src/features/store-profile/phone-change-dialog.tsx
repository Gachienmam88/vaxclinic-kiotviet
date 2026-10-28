"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n";
import { storeProfileNs } from "@/messages/store-profile";
import { FlowFooter, FlowStepper, useVerifyStep } from "./store-flow-parts";
import { useStoreProfileMutation, type StoreProfile } from "./store-profile-queries";

function PhoneBox({ label, phone }: { label: string; phone: string }) {
  return (
    <div className="mx-auto w-fit rounded-md border border-border bg-muted/50 px-3 py-2 text-center">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-[15px] font-semibold">{phone}</div>
    </div>
  );
}

/** "Yêu cầu thay đổi số điện thoại" (ảnh 181): Xác thực → Nhập SĐT mới → Xác nhận. */
export function PhoneChangeDialog({ profile, onClose }: { profile: StoreProfile; onClose: () => void }) {
  const t = useT(storeProfileNs);
  const [step, setStep] = useState(0);
  const [token, setToken] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const verify = useVerifyStep("PHONE", profile.twoFactorEnabled);
  const save = useStoreProfileMutation<{ phone: string; verifyToken: string }>("PUT", "/phone", t("phone.toast"));
  const phoneValid = /^0\d{9}$/.test(phone) && phone !== profile.phone;

  async function next() {
    if (step === 0) {
      const t = await verify.submit();
      if (t) { setToken(t); setStep(1); }
    } else if (step === 1) {
      setStep(2);
    } else if (token) {
      save.mutate({ phone, verifyToken: token }, { onSuccess: onClose });
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-3 sm:max-w-[520px]">
        <DialogHeader><DialogTitle className="text-[17px] font-semibold">{t("phone.title")}</DialogTitle></DialogHeader>
        <FlowStepper steps={[t("phone.steps.verify"), t("phone.steps.newPhone"), t("phone.steps.confirm")]} current={step} />
        <div className="space-y-3 py-1 text-[13px]">
          {step === 0 && (
            <>
              <PhoneBox label={t("phone.current")} phone={profile.phone || t("phone.none")} />
              {verify.fields}
            </>
          )}
          {step === 1 && (
            <label className="grid gap-1">
              <span className="text-xs text-muted-foreground">{t("phone.newLabel")}</span>
              <Input autoFocus inputMode="tel" maxLength={10} placeholder={t("phone.placeholder")} value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} />
              {phone && !phoneValid && <span className="text-xs text-destructive">{t("phone.invalid")}</span>}
            </label>
          )}
          {step === 2 && (
            <>
              <p className="text-center">{t("phone.confirmPrompt")}</p>
              <div className="flex items-center justify-center gap-3">
                <PhoneBox label={t("phone.currentShort")} phone={profile.phone || t("phone.none")} />
                <span aria-hidden>→</span>
                <PhoneBox label={t("phone.newShort")} phone={phone} />
              </div>
              <p className="text-center text-xs text-muted-foreground">{t("phone.usageNote")}</p>
            </>
          )}
        </div>
        <FlowFooter onCancel={onClose} nextLabel={step === 2 ? t("flow.confirm") : t("flow.next")} onNext={() => void next()}
          disabled={(step === 0 && (!verify.valid || verify.pending)) || (step === 1 && !phoneValid) || save.isPending} />
      </DialogContent>
    </Dialog>
  );
}
