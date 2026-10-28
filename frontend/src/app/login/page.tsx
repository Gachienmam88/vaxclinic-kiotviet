"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChartLine, Eye, EyeOff, Phone, ShoppingCart, Syringe } from "lucide-react";
import { LoginLanguageSelect } from "@/features/auth/login-language-select";
import { lookupStore, STORE_KEY, type StoreBrand } from "@/features/auth/store-access-dialog";
import { useT } from "@/lib/i18n";
import { translateApiError } from "@/lib/i18n/translate-api-error";
import { authNs } from "@/messages/auth";

const SUPPORT_PHONE = process.env.NEXT_PUBLIC_SUPPORT_PHONE ?? "";

/**
 * Bước 2 đăng nhập — bố cục theo màn KiotViet (ảnh 1365px): thẻ trắng 293px giữa màn, ô nhập cao 26px chữ 12px,
 * hàng nút cao 36px "Quản lý" (xanh dương) | "Bán hàng" (xanh lá), nền ảnh tối toàn màn.
 * Ảnh nền: public/brand/login-bg.jpg (ảnh đã làm tối sẵn); thiếu file thì dùng nền màu.
 */
export default function LoginPage() {
  const router = useRouter();
  const t = useT(authNs);
  const [store, setStore] = useState<StoreBrand | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  // Tài khoản đã bật xác thực 2 lớp: server trả TOTP_REQUIRED → hiện ô nhập mã (TOTP 6 số hoặc mã khôi phục)
  const [needCode, setNeedCode] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState<"manage" | "sale" | null>(null);
  const [logoFailed, setLogoFailed] = useState(false);

  // Địa chỉ cửa hàng: từ URL, hoặc lần đăng nhập trước; không có / sai → quay về hộp nhập địa chỉ
  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(STORE_KEY); } catch { /* không đọc được: dùng URL */ }
    const code = new URLSearchParams(window.location.search).get("store") ?? saved;
    if (!code) { router.replace("/welcome?login=1"); return; }
    lookupStore(code).then(setStore).catch(() => {
      try { localStorage.removeItem(STORE_KEY); } catch { /* bỏ qua */ }
      router.replace("/welcome?login=1");
    });
  }, [router]);

  async function login(target: "manage" | "sale") {
    if (!username || !password) { setError(t("login.needCredentials")); return; }
    if (needCode && !code) { setError(t("login.needCode")); return; }
    setLoading(target);
    setError(null);
    const res = await fetch("/api/session/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, remember, code: needCode ? code : undefined }),
    });
    if (res.ok) {
      router.replace(target === "sale" ? "/sale" : "/");
      router.refresh();
      return;
    }
    setLoading(null);
    const err = await res.json().catch(() => ({}));
    if (err.code === "TOTP_REQUIRED" && !needCode) {
      setNeedCode(true);
      setError(null);
      setNotice(t("login.totpNotice"));
      return;
    }
    setError(err.message ? translateApiError(err.code ?? "UNKNOWN", err.message) : t("login.failed"));
  }

  const input = "h-[26px] w-full rounded-[5px] border border-[#ced4da] px-2.5 text-xs outline-none focus:border-primary";
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-[#1e2a36] bg-cover bg-center"
      style={{ backgroundImage: "url(/brand/login-bg.jpg), linear-gradient(135deg, #3b4a5a, #1b2530)" }}>
      <form className="w-[293px] overflow-hidden rounded-xl bg-white shadow-2xl" onSubmit={(e) => { e.preventDefault(); void login("manage"); }}>
        <div className="space-y-[9px] px-4 pb-4 pt-5">
          <div className="flex h-[30px] items-center justify-center gap-1.5 pb-2">
            {store?.logo && !logoFailed
              // eslint-disable-next-line @next/next/no-img-element -- logo cửa hàng dạng data URL
              ? <img src={store.logo} alt={store.name} className="max-h-[26px] max-w-36 object-contain" onError={() => setLogoFailed(true)} />
              : <><Syringe className="size-[22px] text-primary" /><span className="text-[17px] font-bold text-[#0a2540]">{store?.name ?? "..."}</span></>}
          </div>
          <input autoFocus value={username} onChange={(e) => setUsername(e.target.value)} placeholder={t("login.username")} autoComplete="username" className={input} />
          <div className="relative">
            <input type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("login.password")}
              autoComplete="current-password" className={`${input} pr-8`} />
            <button type="button" tabIndex={-1} aria-label={show ? t("login.hidePassword") : t("login.showPassword")} onClick={() => setShow(!show)}
              className="absolute right-2 top-[5px] text-[#495057]">{show ? <Eye className="size-4" /> : <EyeOff className="size-4" />}</button>
          </div>
          {needCode && (
            <input autoFocus value={code} onChange={(e) => setCode(e.target.value.trim())} placeholder={t("login.codePlaceholder")}
              inputMode="numeric" autoComplete="one-time-code" maxLength={11} aria-label={t("login.codeLabel")} className={input} />
          )}
          <div className="flex items-center gap-1.5 pt-0.5 text-[11px]">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" className="size-[13px] accent-primary" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> {t("login.remember")}
            </label>
            <span className="text-[#ced4da]">|</span>
            <button type="button" className="text-primary hover:underline"
              onClick={() => setNotice(t("login.forgotNotice"))}>{t("login.forgot")}</button>
          </div>
          {error && <p className="text-[11px] text-destructive">{error}</p>}
          {notice && <p className="text-[11px] text-[#0a58ca]">{notice}</p>}
        </div>
        <div className="grid grid-cols-2">
          <button type="submit" disabled={!!loading || !store}
            className="flex h-9 items-center justify-center gap-1.5 bg-primary text-[13px] font-bold text-white hover:bg-primary-hover disabled:opacity-70">
            <ChartLine className="size-4" /> {loading === "manage" ? t("login.entering") : t("login.manage")}</button>
          <button type="button" disabled={!!loading || !store} onClick={() => void login("sale")}
            className="flex h-9 items-center justify-center gap-1.5 bg-[#00b63e] text-[13px] font-bold text-white hover:bg-[#00a136] disabled:opacity-70">
            <ShoppingCart className="size-4" /> {loading === "sale" ? t("login.entering") : t("login.sale")}</button>
        </div>
      </form>
      <div className="absolute bottom-3 flex items-center gap-4 text-[11px] font-semibold text-white">
        {SUPPORT_PHONE && <span className="flex items-center gap-1"><Phone className="size-3" /> {t("login.support", { phone: SUPPORT_PHONE })}</span>}
        <button type="button" onClick={() => router.push("/welcome?login=1")} className="hover:underline">{t("login.changeStore")}</button>
        <LoginLanguageSelect />
      </div>
    </main>
  );
}
