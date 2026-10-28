"use client";

import { useState } from "react";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  const [step, setStep] = useState<"info" | "date" | "verify">("info");
  const [reopenOn, setReopenOn] = useState(ymd(30));
  const verify = useVerifyStep("PAUSE", profile.twoFactorEnabled);
  const save = useStoreProfileMutation<{ reopenOn: string; verifyToken: string }>("POST", "/pause", "Đã bảo lưu gian hàng");
  const min = ymd(1), max = ymd(MAX_DAYS);
  const dateValid = !!reopenOn && reopenOn >= min && reopenOn <= max;

  async function submit() {
    const verifyToken = await verify.submit();
    if (verifyToken) save.mutate({ reopenOn, verifyToken }, { onSuccess: onClose });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-3 sm:max-w-[520px]">
        <DialogHeader><DialogTitle className="text-[17px] font-semibold">Bảo lưu gian hàng là gì?</DialogTitle></DialogHeader>
        {step === "info" && (
          <div className="space-y-3 text-[13px] leading-5">
            <p>Bảo lưu gian hàng cho phép tạm khóa gian hàng khi không có nhu cầu sử dụng mà vẫn giữ nguyên vẹn dữ liệu.
              Trong thời gian bảo lưu, mọi nhân viên sẽ không sử dụng được tính năng nào của hệ thống.</p>
            <p className="font-semibold">Thông tin thời hạn bảo lưu:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Thời hạn bảo lưu tối đa 2 tháng. Gian hàng sẽ tự động mở lại vào ngày mở lại bạn chọn.</li>
              <li>Chủ gian hàng có thể chủ động mở lại gian hàng trước khi hết thời gian bảo lưu.</li>
              <li>Dữ liệu, thiết lập và tài khoản được giữ nguyên trong thời gian bảo lưu.</li>
            </ul>
            <p className="text-orange-600">Lưu ý: Gian hàng chỉ được bảo lưu một lần duy nhất trong suốt quá trình sử dụng.</p>
          </div>
        )}
        {step === "date" && (
          <label className="grid gap-1 text-[13px]">
            <span className="text-xs text-muted-foreground">Ngày tự động mở lại gian hàng (tối đa {MAX_DAYS} ngày kể từ hôm nay)</span>
            <DatePicker value={reopenOn} min={min} max={max} onChange={setReopenOn} />
            {!dateValid && <span className="text-xs text-destructive">Chọn ngày từ ngày mai đến tối đa {MAX_DAYS} ngày sau</span>}
          </label>
        )}
        {step === "verify" && verify.fields}
        <FlowFooter onCancel={onClose} cancelLabel="Bỏ qua" nextLabel={step === "verify" ? "Bảo lưu" : "Tiếp tục"}
          disabled={(step === "date" && !dateValid) || (step === "verify" && (!verify.valid || verify.pending || save.isPending))}
          onNext={() => (step === "info" ? setStep("date") : step === "date" ? setStep("verify") : void submit())} />
      </DialogContent>
    </Dialog>
  );
}
