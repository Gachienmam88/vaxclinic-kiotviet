"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LogIn, LogOut, QrCode, ScanLine } from "lucide-react";
import { api, errorMessage } from "@/lib/api-client";
import { ClockQrScanner, tokenFromQr } from "./clock-qr-scanner";
import { hm, timeOf } from "./hr-queries";
import { ATTENDANCE_STATUS, type AttendanceCell, type MobileSettings } from "./hr-types";

type Me = { linked: boolean; employeeId: string | null; code: string | null; name: string | null; mobile: MobileSettings; cells: AttendanceCell[] };
type ClockResult = { message: string; branchName: string | null; me: Me };

/** Mã QR có hiệu lực ~2 phút: sau 100 giây coi như cần quét lại. */
const TOKEN_TTL_MS = 100_000;

/**
 * Màn chấm công trên điện thoại (/cham-cong). Quét mã QR chi nhánh (camera điện thoại mở /cham-cong?t=… hoặc quét trong trang),
 * rồi bấm Vào ca / Ra ca. Server kiểm tra token HMAC còn hạn và nhân viên thuộc chi nhánh.
 */
export function MobileClockScreen() {
  const sp = useSearchParams();
  const qc = useQueryClient();
  const [token, setToken] = useState<{ value: string; at: number } | null>(() => {
    const t = sp.get("t");
    return t ? { value: tokenFromQr(t) ?? t, at: Date.now() } : null;
  });
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 5000); return () => clearInterval(t); }, []);
  const { data: me, isLoading } = useQuery({ queryKey: ["clock-me"], queryFn: () => api<Me>("/hr/clock/me") });
  const fresh = token && Date.now() - token.at < TOKEN_TTL_MS ? token.value : null;
  const punch = useMutation({
    mutationFn: (action: "IN" | "OUT") => api<ClockResult>("/hr/clock", { method: "POST", body: { action, token: fresh } }),
    onSuccess: (r) => {
      setMessage({ ok: true, text: r.message + (r.branchName ? ` · ${r.branchName}` : "") });
      qc.setQueryData(["clock-me"], r.me);
    },
    onError: (e) => setMessage({ ok: false, text: errorMessage(e) }),
  });
  const onToken = useCallback((t: string) => { setToken({ value: t, at: Date.now() }); setScanning(false); setMessage(null); }, []);
  const needQr = me?.mobile.requireQr && !fresh;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col bg-[#f3f5f8] px-4 pt-6 pb-10">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Chấm công</h1>
        <button type="button" className="text-sm text-muted-foreground" onClick={async () => {
          await fetch("/api/session/logout", { method: "POST" });
          window.location.href = "/welcome?login=1";
        }}>Đăng xuất</button>
      </div>
      {isLoading && <p className="text-center text-muted-foreground">Đang tải…</p>}
      {me && !me.linked && (
        <p className="rounded-xl bg-white p-4 text-center">Tài khoản của bạn chưa được liên kết với hồ sơ nhân viên. Liên hệ quản lý để được thiết lập.</p>
      )}
      {me?.linked && (
        <>
          <div className="rounded-xl bg-white p-4">
            <p className="text-lg font-semibold">{me.name}</p>
            <p className="text-sm text-muted-foreground">{me.code} · {new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}</p>
            <div className="mt-3 space-y-2">
              {!me.cells.length && <p className="text-sm text-muted-foreground">Hôm nay bạn chưa được xếp ca làm việc.</p>}
              {me.cells.map((c) => (
                <div key={`${c.shiftId}-${c.date}`} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium">{c.shiftName} <span className="text-muted-foreground">({hm(c.shiftStart)} - {hm(c.shiftEnd)})</span></p>
                    <p className="text-muted-foreground">Vào {timeOf(c.checkIn) || "--:--"} · Ra {timeOf(c.checkOut) || "--:--"}</p>
                  </div>
                  <span className="text-xs font-semibold" style={{ color: ATTENDANCE_STATUS[c.status].color }}>{ATTENDANCE_STATUS[c.status].label}</span>
                </div>
              ))}
            </div>
          </div>
          {!me.mobile.enabled ? (
            <p className="mt-4 rounded-xl bg-white p-4 text-center">Cửa hàng chưa bật chấm công trên điện thoại.</p>
          ) : (
            <>
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-white p-3 text-sm">
                <QrCode className={fresh ? "size-5 text-[#16a34a]" : "size-5 text-muted-foreground"} />
                <span className="flex-1">{fresh ? "Đã quét mã QR chi nhánh" : me.mobile.requireQr ? "Quét mã QR đang hiển thị tại quầy để chấm công" : "Không bắt buộc quét mã QR"}</span>
                <button type="button" className="flex items-center gap-1 font-semibold text-primary" onClick={() => setScanning(true)}><ScanLine className="size-4" /> Quét mã</button>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button type="button" disabled={!!needQr || punch.isPending} onClick={() => punch.mutate("IN")}
                  className="flex h-28 flex-col items-center justify-center gap-2 rounded-2xl bg-primary text-lg font-bold text-white disabled:opacity-40">
                  <LogIn className="size-8" /> Vào ca
                </button>
                <button type="button" disabled={!!needQr || punch.isPending} onClick={() => punch.mutate("OUT")}
                  className="flex h-28 flex-col items-center justify-center gap-2 rounded-2xl bg-[#16a34a] text-lg font-bold text-white disabled:opacity-40">
                  <LogOut className="size-8" /> Ra ca
                </button>
              </div>
            </>
          )}
          {message && <p className={`mt-4 rounded-xl p-3 text-center text-sm font-medium ${message.ok ? "bg-[#dcfce7] text-[#166534]" : "bg-[#fee2e2] text-[#991b1b]"}`}>{message.text}</p>}
        </>
      )}
      {scanning && <ClockQrScanner onToken={onToken} onClose={() => setScanning(false)} />}
    </main>
  );
}
