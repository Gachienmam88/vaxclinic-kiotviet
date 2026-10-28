"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useT } from "@/lib/i18n";
import { translateApiError } from "@/lib/i18n/translate-api-error";
import { authNs } from "@/messages/auth";
import { commonNs } from "@/messages/common";

export const STORE_KEY = "vx_store";
/** Đuôi hiển thị sau ô địa chỉ (như ".kiotviet.vn"); đặt NEXT_PUBLIC_STORE_DOMAIN khi có tên miền. */
const DOMAIN_SUFFIX = process.env.NEXT_PUBLIC_STORE_DOMAIN ? `.${process.env.NEXT_PUBLIC_STORE_DOMAIN}` : ".vaxclinic";
export type StoreBrand = { code: string; name: string; logo: string };

/** Kiểm tra địa chỉ truy cập; đúng → trả tên + logo cửa hàng, sai → ném lỗi (message server, dịch theo code; rỗng nếu server không trả). */
export async function lookupStore(code: string): Promise<StoreBrand> {
  const res = await fetch(`/api/session/store?code=${encodeURIComponent(code.trim().toLowerCase())}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message ? translateApiError(body.code ?? "UNKNOWN", body.message) : "");
  return body as StoreBrand;
}

/** Hộp "Đăng nhập tài khoản": nhập địa chỉ truy cập cửa hàng → sang màn đăng nhập của cửa hàng đó. */
export function StoreAccessDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const t = useT(authNs);
  const tc = useT(commonNs);
  const [code, setCode] = useState(() => {
    try { return localStorage.getItem(STORE_KEY) ?? ""; } catch { return ""; }
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) { setError(t("storeAccess.required")); return; }
    setLoading(true);
    try {
      const store = await lookupStore(code);
      try { localStorage.setItem(STORE_KEY, store.code); } catch { /* trình duyệt chặn lưu: vẫn đăng nhập được */ }
      router.push(`/login?store=${encodeURIComponent(store.code)}`);
    } catch (err) {
      setError((err as Error).message || t("storeAccess.notFound"));
      setLoading(false);
    }
  }

  // Số đo theo ảnh KiotViet: hộp 480px bo 16px, ô nhập cao 54px có đuôi tên miền, nút "Vào cửa hàng" 166×46
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#5b6b82]/60 p-4 backdrop-blur-[6px]" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="w-full max-w-[480px] rounded-2xl bg-white px-8 pb-8 pt-7 shadow-2xl">
        <div className="mb-6 flex items-center">
          <h2 className="text-[21px] font-bold text-[#111827]">{t("storeAccess.title")}</h2>
          <button type="button" aria-label={tc("actions.close")} className="ml-auto text-[#374151] hover:text-black" onClick={onClose}><X className="size-6" /></button>
        </div>
        <div className={`flex h-[54px] items-center rounded-[10px] border pl-4 pr-1.5 ${error ? "border-destructive" : "border-primary"}`}>
          <input autoFocus value={code} onChange={(e) => { setCode(e.target.value); setError(""); }}
            placeholder={t("storeAccess.placeholder")} autoComplete="organization" spellCheck={false}
            className="h-full flex-1 bg-transparent text-[15px] outline-none placeholder:text-[#9ca3af]" />
          <span className="flex h-[42px] items-center rounded-lg bg-[#f3f4f6] px-3 text-[15px] text-[#374151]">{DOMAIN_SUFFIX}</span>
        </div>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        <p className="mt-4 text-[15px] text-[#374151]">{t("storeAccess.noAddress")} <span className="font-semibold text-primary">{t("storeAccess.contactAdmin")}</span></p>
        <div className="mt-6 flex justify-end">
          <button type="submit" disabled={loading}
            className="h-[46px] w-[166px] rounded-xl bg-primary text-[17px] font-bold text-white hover:bg-primary-hover disabled:opacity-70">
            {loading ? t("storeAccess.checking") : t("storeAccess.submit")}</button>
        </div>
      </form>
    </div>
  );
}
