"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/api-client";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { storeProfileNs } from "@/messages/store-profile";
import { verifyAction, type VerifyPurpose } from "./store-profile-queries";

/** Thanh 3 bước trong hộp thoại (ảnh 181 / 182): vòng số 20px nối bằng gạch, nhãn 11px, bước hiện tại màu chủ đạo. */
export function FlowStepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="-mx-4 flex justify-center bg-muted/60 px-4 pt-3 pb-2.5">
      {steps.map((label, i) => (
        <div key={label} className="flex items-start">
          {i > 0 && <div className={cn("mt-2.5 h-px w-12", i <= current ? "bg-primary" : "bg-border")} />}
          <div className="flex w-[100px] flex-col items-center gap-1">
            <span className={cn("flex size-5 items-center justify-center rounded-full border text-[11px] font-semibold",
              i < current && "border-primary bg-primary text-primary-foreground",
              i === current && "border-primary bg-primary text-primary-foreground ring-4 ring-primary/15",
              i > current && "border-border bg-background text-muted-foreground")}>
              {i < current ? <Check className="size-3" /> : i + 1}
            </span>
            <span className={cn("text-center text-[11px]", i === current ? "text-primary" : "text-muted-foreground")}>{label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Bước "Xác thực" dùng chung. KiotViet gửi OTP qua SMS; hệ thống nội bộ không có nhà cung cấp SMS nên xác thực bằng
 * mã ứng dụng Authenticator (đã bật xác thực 2 lớp) hoặc mật khẩu đăng nhập hiện tại (chưa bật).
 * Trả về ô nhập + hàm submit() → phiếu xác thực (null nếu lỗi, lỗi hiện dưới ô).
 */
export function useVerifyStep(purpose: VerifyPurpose, twoFactor: boolean) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const t = useT(storeProfileNs);
  const valid = twoFactor ? /^\d{6}$/.test(value) : value.length > 0;

  async function submit(): Promise<string | null> {
    setPending(true);
    setError(null);
    try {
      const r = await verifyAction(purpose, twoFactor ? null : value, twoFactor ? value : null);
      return r.verifyToken;
    } catch (e) {
      setError(errorMessage(e));
      return null;
    } finally {
      setPending(false);
    }
  }

  const fields = (
    <div className="space-y-2 text-[13px]">
      <p className="text-muted-foreground">
        {twoFactor ? t("verify.hintTotp") : t("verify.hintPassword")}
      </p>
      <p className="text-xs text-muted-foreground">
        {t("verify.noSms")}
      </p>
      <Input autoFocus type={twoFactor ? "text" : "password"} inputMode={twoFactor ? "numeric" : undefined}
        autoComplete={twoFactor ? "one-time-code" : "current-password"} maxLength={twoFactor ? 6 : 100}
        placeholder={twoFactor ? t("verify.codePlaceholder") : t("verify.password")} aria-label={twoFactor ? t("verify.codeLabel") : t("verify.password")}
        value={value} onChange={(e) => setValue(twoFactor ? e.target.value.replace(/\D/g, "") : e.target.value)} />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
  return { fields, submit, pending, valid };
}

/** Hai nút chân hộp thoại kiểu KiotViet: "Hủy bỏ" viền (mặc định) + nút chính. */
export function FlowFooter({ onCancel, onNext, nextLabel, disabled, cancelLabel }: {
  onCancel: () => void; onNext: () => void; nextLabel: string; disabled?: boolean; cancelLabel?: string;
}) {
  const t = useT(storeProfileNs);
  return (
    <div className="-mx-4 -mb-4 mt-1 flex justify-end gap-2 border-t border-border px-4 py-3">
      <button type="button" onClick={onCancel}
        className="h-9 rounded-md border border-border bg-background px-4 text-[13px] font-semibold hover:bg-muted">{cancelLabel ?? t("flow.cancel")}</button>
      <button type="button" onClick={onNext} disabled={disabled}
        className="h-9 rounded-md bg-primary px-4 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">{nextLabel}</button>
    </div>
  );
}
