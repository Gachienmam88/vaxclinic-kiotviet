"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { STORE_KEY } from "@/features/auth/store-access-dialog";
import { api, errorMessage } from "@/lib/api-client";
import { FlowFooter, FlowStepper, useVerifyStep } from "./store-flow-parts";
import type { StoreProfile } from "./store-profile-queries";

const STEPS = ["Thông tin lưu ý", "Nhập tên mới", "Xác thực"];

/** Các tác động của việc đổi tên (ảnh 182) — viết lại cho hệ thống nội bộ. */
const WARNINGS: { title: string; points: string[] }[] = [
  { title: "Toàn bộ thiết bị bị đăng xuất ngay lập tức", points: [
    "Tất cả nhân viên đang đăng nhập trên web và máy bán hàng tại quầy sẽ bị đăng xuất, kể cả bạn.",
    "Bạn có trách nhiệm thông báo tên gian hàng mới cho toàn bộ nhân viên trước hoặc ngay sau khi đổi.",
  ] },
  { title: "Các liên kết đang dùng sẽ không còn hoạt động", points: [
    "Link đăng nhập cũ, bookmark trên trình duyệt có chứa tên cũ sẽ không vào được. Cần cập nhật và thông báo link mới.",
  ] },
  { title: "Tên cũ không được giữ lại sau khi đổi", points: [
    "Muốn dùng lại tên cũ phải đổi tên thêm một lần nữa (mọi thiết bị lại bị đăng xuất).",
  ] },
];

/** "Đổi tên gian hàng": lưu ý + xác nhận đã đọc → tên mới (địa chỉ truy cập) → Xác thực. Xong → về trang đăng nhập. */
export function RenameStoreDialog({ profile, onClose }: { profile: StoreProfile; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [agreed, setAgreed] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const verify = useVerifyStep("RENAME", profile.twoFactorEnabled);
  const codeValid = /^[a-z0-9]{3,40}$/.test(code) && code !== profile.accessCode;

  async function submit() {
    const verifyToken = await verify.submit();
    if (!verifyToken) return;
    setSaving(true);
    try {
      // Không dùng React Query: phiên hiện tại bị thu hồi ngay sau khi đổi, làm mới dữ liệu sẽ lỗi 401
      await api("/store-profile/access-code", { method: "PUT", body: { accessCode: code, verifyToken } });
      try { localStorage.setItem(STORE_KEY, code); } catch { /* trình duyệt chặn lưu: nhập lại địa chỉ khi đăng nhập */ }
      await fetch("/api/session/logout", { method: "POST" }).catch(() => undefined);
      window.location.href = `/login?store=${encodeURIComponent(code)}`;
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-h-[90vh] gap-3 overflow-y-auto sm:max-w-[600px]">
        <DialogHeader><DialogTitle className="text-[17px] font-semibold">Đổi tên gian hàng</DialogTitle></DialogHeader>
        <FlowStepper steps={STEPS} current={step} />
        {step === 0 && (
          <div className="space-y-3 text-[13px]">
            <p>Trước khi đổi tên gian hàng, hãy hiểu rõ các tác động sẽ xảy ra.</p>
            <ol className="divide-y divide-border rounded-lg border border-border">
              {WARNINGS.map((w, i) => (
                <li key={w.title} className="flex gap-2.5 px-3 py-3">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">{i + 1}</span>
                  <div>
                    <p className="font-semibold">{w.title}</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground">{w.points.map((p) => <li key={p}>{p}</li>)}</ul>
                  </div>
                </li>
              ))}
            </ol>
            <label className="flex items-center gap-2">
              <input type="checkbox" className="size-4 accent-primary" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              Tôi đã đọc và hiểu rõ các tác động của việc đổi tên gian hàng
            </label>
          </div>
        )}
        {step === 1 && (
          <div className="space-y-2 text-[13px]">
            <p>Tên hiện tại: <b>{profile.accessCode}</b></p>
            <label className="grid gap-1">
              <span className="text-xs text-muted-foreground">Tên gian hàng mới (địa chỉ truy cập nhập ở bước đầu khi đăng nhập)</span>
              <Input autoFocus value={code} maxLength={40} placeholder="VD: vacxinso1yenlac"
                onChange={(e) => setCode(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""))} />
            </label>
            <p className="text-xs text-muted-foreground">Chỉ gồm chữ thường không dấu và số, 3–40 ký tự, khác tên hiện tại.</p>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-3">
            <p className="text-[13px]">Đổi tên gian hàng <b>{profile.accessCode}</b> thành <b>{code}</b>.</p>
            {verify.fields}
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        )}
        <FlowFooter onCancel={onClose} nextLabel={step === 2 ? "Đổi tên" : "Tiếp tục"}
          disabled={(step === 0 && !agreed) || (step === 1 && !codeValid) || (step === 2 && (!verify.valid || verify.pending || saving))}
          onNext={() => (step < 2 ? setStep(step + 1) : void submit())} />
      </DialogContent>
    </Dialog>
  );
}
