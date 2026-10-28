"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { hrNs } from "@/messages/hr";

/** BarcodeDetector (Chrome / Android, Safari mới) — chưa có trong lib.dom của TypeScript. */
type Detector = { detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
type DetectorCtor = new (opts: { formats: string[] }) => Detector;

/** Lấy token từ nội dung mã QR: URL ".../cham-cong?t=..." hoặc chính token. */
export function tokenFromQr(raw: string): string | null {
  try {
    const t = new URL(raw).searchParams.get("t");
    if (t) return t;
  } catch { /* không phải URL */ }
  return /^[0-9a-f-]{36}\.\d+\.[\w-]+$/i.test(raw.trim()) ? raw.trim() : null;
}

/** Quét mã QR chi nhánh ngay trong trang bằng camera sau (khi trình duyệt hỗ trợ BarcodeDetector). */
export function ClockQrScanner({ onToken, onClose }: { onToken: (t: string) => void; onClose: () => void }) {
  const t = useT(hrNs);
  const tc = useT(commonNs);
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const Ctor = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
    if (!Ctor) {
      setError(t("scanner.unsupported"));
      return;
    }
    let stream: MediaStream | null = null;
    let stop = false;
    const detector = new Ctor({ formats: ["qr_code"] });
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!video.current || stop) return;
        video.current.srcObject = stream;
        await video.current.play();
        while (!stop) {
          const codes = await detector.detect(video.current).catch(() => []);
          const token = codes.map((c) => tokenFromQr(c.rawValue)).find(Boolean);
          if (token) { onToken(token); return; }
          await new Promise((r) => setTimeout(r, 300));
        }
      } catch {
        setError(t("scanner.cameraError"));
      }
    })();
    return () => { stop = true; stream?.getTracks().forEach((t) => t.stop()); };
  }, [onToken, t]);
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <div className="flex items-center justify-between p-4">
        <span className="font-semibold">{t("scanner.title")}</span>
        <button type="button" aria-label={tc("actions.close")} onClick={onClose}><X className="size-6" /></button>
      </div>
      {error ? <p className="p-6 text-center">{error}</p> : <video ref={video} playsInline muted className="w-full flex-1 object-cover" />}
    </div>
  );
}
