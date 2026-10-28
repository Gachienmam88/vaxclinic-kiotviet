"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api, errorMessage } from "@/lib/api-client";
import { useT } from "@/lib/i18n";
import { authNs } from "@/messages/auth";

type Setup = { secret: string; otpauthUrl: string };

const BTN = "h-9 rounded-md px-4 text-[13px] font-semibold disabled:opacity-50";
const PRIMARY = `${BTN} bg-primary text-primary-foreground hover:bg-primary/90`;
const OUTLINE = `${BTN} border border-border bg-background hover:bg-muted`;

/** Mã khôi phục chỉ hiện 1 lần: cho chép / tải về trước khi đóng. */
function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const t = useT(authNs);
  const text = codes.join("\n");
  return (
    <div className="space-y-3 text-[13px]">
      <p className="font-semibold text-primary">{t("twoFactor.enabled")}</p>
      <p>{t("twoFactor.recoveryIntro")}</p>
      <div className="grid grid-cols-2 gap-1.5 rounded-md bg-muted p-3 font-mono text-[13px]">{codes.map((c) => <span key={c}>{c}</span>)}</div>
      <div className="flex justify-end gap-2">
        <button type="button" className={OUTLINE} onClick={() => navigator.clipboard.writeText(text).then(() => toast.success(t("twoFactor.copied")))}>{t("twoFactor.copy")}</button>
        <a className={`${OUTLINE} flex items-center`} download={t("twoFactor.downloadFileName")} href={`data:text/plain;charset=utf-8,${encodeURIComponent(text)}`}>{t("twoFactor.download")}</a>
        <button type="button" className={PRIMARY} onClick={onDone}>{t("twoFactor.savedCodes")}</button>
      </div>
    </div>
  );
}

/** Bật: quét QR (khóa tạo ở server, QR vẽ tại trình duyệt) → nhập mã 6 số → nhận mã khôi phục. */
function EnableFlow({ onDone }: { onDone: () => void }) {
  const t = useT(authNs);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Mỗi lần gọi tạo khóa mới thay khóa cũ: bỏ kết quả của lần gọi đã hủy (StrictMode chạy effect 2 lần)
    let cancelled = false;
    api<Setup>("/auth/2fa/setup", { method: "POST" })
      .then(async (s) => {
        const image = await QRCode.toDataURL(s.otpauthUrl, { width: 200, margin: 1 });
        if (!cancelled) { setSetup(s); setQr(image); }
      })
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => { cancelled = true; };
  }, []);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      setCodes((await api<{ recoveryCodes: string[] }>("/auth/2fa/enable", { method: "POST", body: { code } })).recoveryCodes);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (codes) return <RecoveryCodes codes={codes} onDone={onDone} />;
  return (
    <div className="space-y-3 text-[13px]">
      <p>{t("twoFactor.step1")}</p>
      <div className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- QR dạng data URL vẽ tại trình duyệt */}
        {qr ? <img src={qr} alt={t("twoFactor.qrAlt")} className="size-[200px] rounded border" /> : <div className="size-[200px] animate-pulse rounded bg-muted" />}
        <div className="min-w-0 space-y-1">
          <p className="text-xs text-muted-foreground">{t("twoFactor.manualKey")}</p>
          <p className="break-all font-mono text-[13px] font-semibold">{setup?.secret.replace(/(.{4})/g, "$1 ").trim()}</p>
        </div>
      </div>
      <p>{t("twoFactor.step2")}</p>
      <Input autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder={t("twoFactor.codePlaceholder")} value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex justify-end">
        <button type="button" className={PRIMARY} disabled={code.length !== 6 || busy || !setup} onClick={() => void confirm()}>{t("twoFactor.enable")}</button>
      </div>
    </div>
  );
}

/** Tắt / tạo lại mã khôi phục: cần mật khẩu + mã (Authenticator hoặc mã khôi phục). */
function ManageFlow({ onDone, onCodes }: { onDone: () => void; onCodes: (c: string[]) => void }) {
  const t = useT(authNs);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function run(path: "disable" | "recovery-codes") {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ recoveryCodes?: string[] }>(`/auth/2fa/${path}`, { method: "POST", body: { password, code } });
      if (path === "disable") { toast.success(t("twoFactor.disabled")); onDone(); } else if (r.recoveryCodes) onCodes(r.recoveryCodes);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-3 text-[13px]">
      <p>{t("twoFactor.manageIntro")}</p>
      <Input type="password" autoComplete="current-password" placeholder={t("twoFactor.password")} value={password} onChange={(e) => setPassword(e.target.value)} />
      <Input autoComplete="one-time-code" placeholder={t("twoFactor.codeOrRecovery")} value={code} onChange={(e) => setCode(e.target.value.trim())} />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className={OUTLINE} disabled={!password || !code || busy} onClick={() => void run("recovery-codes")}>{t("twoFactor.regenerate")}</button>
        <button type="button" className={`${BTN} bg-destructive text-white hover:bg-destructive/90`} disabled={!password || !code || busy}
          onClick={() => void run("disable")}>{t("twoFactor.disable")}</button>
      </div>
    </div>
  );
}

/** Hộp thoại "Xác thực 2 lớp" mở từ menu tài khoản. */
export function TwoFactorDialog({ enabled, onClose }: { enabled: boolean; onClose: () => void }) {
  const t = useT(authNs);
  const qc = useQueryClient();
  const [codes, setCodes] = useState<string[] | null>(null);
  const done = () => { void qc.invalidateQueries({ queryKey: ["me"] }); void qc.invalidateQueries({ queryKey: ["store-profile"] }); onClose(); };
  return (
    <Dialog open onOpenChange={(o) => !o && done()}>
      <DialogContent className="gap-3 sm:max-w-[520px]">
        <DialogHeader><DialogTitle className="text-[17px] font-semibold">{t("twoFactor.title")}</DialogTitle></DialogHeader>
        {codes ? <RecoveryCodes codes={codes} onDone={done} /> : enabled ? <ManageFlow onDone={done} onCodes={setCodes} /> : <EnableFlow onDone={done} />}
      </DialogContent>
    </Dialog>
  );
}
