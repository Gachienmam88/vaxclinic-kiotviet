"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Maximize2, X } from "lucide-react";
import { api, errorMessage } from "@/lib/api-client";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { hrNs } from "@/messages/hr";

type QrToken = { token: string; branchId: string; branchName: string; expiresAt: string; refreshSeconds: number };

/**
 * Mã QR chấm công của chi nhánh, hiển thị trên màn hình tại quầy. Mã đổi mỗi phút (HMAC phía server),
 * nhân viên quét bằng camera điện thoại → mở /cham-cong?t=... đã đăng nhập → bấm Vào ca / Ra ca.
 */
export function BranchClockQrDisplay({ branchId, onClose }: { branchId: string; onClose: () => void }) {
  const t = useT(hrNs);
  const tc = useT(commonNs);
  const [qr, setQr] = useState<QrToken | null>(null);
  const [image, setImage] = useState("");
  const [left, setLeft] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let alive = true;
    const load = async () => {
      try {
        const t = await api<QrToken>(`/hr/clock/qr?branchId=${branchId}`);
        const url = `${window.location.origin}/cham-cong?t=${encodeURIComponent(t.token)}`;
        const img = await QRCode.toDataURL(url, { width: 420, margin: 1, errorCorrectionLevel: "M" });
        if (!alive) return;
        setQr(t); setImage(img); setLeft(t.refreshSeconds); setError("");
        timer = setTimeout(load, t.refreshSeconds * 1000 + 300);
      } catch (e) {
        if (!alive) return;
        setError(errorMessage(e));
        timer = setTimeout(load, 10_000);
      }
    };
    load();
    return () => { alive = false; clearTimeout(timer); };
  }, [branchId]);

  useEffect(() => {
    const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white p-6 text-center">
      <button type="button" aria-label={tc("actions.close")} onClick={onClose} className="absolute top-4 right-4 rounded-full p-2 hover:bg-muted"><X className="size-6" /></button>
      <button type="button" aria-label={t("clockQr.fullscreen")} onClick={() => document.documentElement.requestFullscreen?.().catch(() => undefined)}
        className="absolute top-4 right-16 rounded-full p-2 hover:bg-muted"><Maximize2 className="size-5" /></button>
      <p className="text-2xl font-bold">{t("clockQr.title")}</p>
      <p className="mt-1 text-lg text-muted-foreground">{qr?.branchName ?? ""}</p>
      {/* eslint-disable-next-line @next/next/no-img-element -- ảnh QR dạng data URL sinh tại trình duyệt */}
      {image && <img src={image} alt={t("clockQr.alt")} className="mt-6 size-[min(70vh,420px)]" />}
      {error && <p className="mt-6 text-destructive">{error}</p>}
      <p className="mt-4 text-sm text-muted-foreground">{t("clockQr.hint", { seconds: left })}</p>
    </div>
  );
}
