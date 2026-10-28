"use client";

import { useState } from "react";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useT } from "@/lib/i18n";
import { storeProfileNs } from "@/messages/store-profile";
import { FlowFooter, useVerifyStep } from "./store-flow-parts";
import { useStoreProfileMutation, type StoreProfile } from "./store-profile-queries";

const MAX_DAYS = 60;

/** yyyy-MM-dd theo giờ máy, cộng `days` ngày. */
function ymd(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "Bảo lưu gian hàng là gì?" (ảnh 178) → chọn ngày tự mở lại (≤ 60 ngày) → Xác thực. Chỉ chủ gian hàng, 1 lần duy nhất. */
export function PauseStoreDialog({ profile, onClose }: { profile: StoreProfile; onClose: () => void }) {
  const t = useT(storeProfileNs);
  const [step, setStep] = useState<"info" | "date" | "verify">("info");
  const [reopenOn, setReopenOn] = useState(ymd(30));
  const verify = useVerifyStep("PAUSE", profile.twoFactorEnabled);
  const save = useStoreProfileMutation<{ reopenOn: string; verifyToken: string }>("POST", "/pause", t("pause.toast"));
  const min = ymd(1), max = ymd(MAX_DAYS);
  const dateValid = !!reopenOn && reopenOn >= min && reopenOn <= max;

  async function submit() {
    const verifyToken = await verify.submit();
    if (verifyToken) save.mutate({ reopenOn, verifyToken }, { onSuccess: onClose });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-3 sm:max-w-[520px]">
        <DialogHeader><DialogTitle className="text-[17px] font-semibold">{t("pause.title")}</DialogTitle></DialogHeader>
        {step === "info" && (
          <div className="space-y-3 text-[13px] leading-5">
            <p>{t("pause.intro")}</p>
            <p className="font-semibold">{t("pause.termsTitle")}</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>{t("pause.term1")}</li>
              <li>{t("pause.term2")}</li>
              <li>{t("pause.term3")}</li>
            </ul>
            <p className="text-orange-600">{t("pause.onceNote")}</p>
          </div>
        )}
        {step === "date" && (
          <label className="grid gap-1 text-[13px]">
            <span className="text-xs text-muted-foreground">{t("pause.dateLabel", { days: MAX_DAYS })}</span>
            <DatePicker value={reopenOn} min={min} max={max} onChange={setReopenOn} />
            {!dateValid && <span className="text-xs text-destructive">{t("pause.dateError", { days: MAX_DAYS })}</span>}
          </label>
        )}
        {step === "verify" && verify.fields}
        <FlowFooter onCancel={onClose} cancelLabel={t("flow.skip")} nextLabel={step === "verify" ? t("pause.submit") : t("flow.next")}
          disabled={(step === "date" && !dateValid) || (step === "verify" && (!verify.valid || verify.pending || save.isPending))}
          onNext={() => (step === "info" ? setStep("date") : step === "date" ? setStep("verify") : void submit())} />
      </DialogContent>
    </Dialog>
  );
}
