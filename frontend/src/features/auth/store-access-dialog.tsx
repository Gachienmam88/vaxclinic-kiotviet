"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export const STORE_KEY = "vx_store";
export type StoreBrand = { code: string; name: string; logo: string };

/** Kiểm tra địa chỉ truy cập; đúng → trả tên + logo cửa hàng, sai → ném lỗi có thông báo tiếng Việt. */
export async function lookupStore(code: string): Promise<StoreBrand> {
  const res = await fetch(`/api/session/store?code=${encodeURIComponent(code.trim().toLowerCase())}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message ?? "Không tìm thấy cửa hàng");
  return body as StoreBrand;
}

/** Hộp "Đăng nhập tài khoản": nhập địa chỉ truy cập cửa hàng → sang màn đăng nhập của cửa hàng đó. */
export function StoreAccessDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [code, setCode] = useState(() => {
    try { return localStorage.getItem(STORE_KEY) ?? ""; } catch { return ""; }
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) { setError("Nhập địa chỉ truy cập cửa hàng"); return; }
    setLoading(true);
    try {
      const store = await lookupStore(code);
      try { localStorage.setItem(STORE_KEY, store.code); } catch { /* trình duyệt chặn lưu: vẫn đăng nhập được */ }
      router.push(`/login?store=${encodeURIComponent(store.code)}`);
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="w-full max-w-md space-y-5 rounded-2xl bg-white p-7 shadow-2xl">
        <div className="flex items-center">
          <h2 className="text-xl font-bold text-slate-900">Đăng nhập tài khoản</h2>
          <button type="button" aria-label="Đóng" className="ml-auto text-slate-500 hover:text-slate-900" onClick={onClose}><X className="size-5" /></button>
        </div>
        <div className={`flex items-center rounded-xl border-2 px-3 focus-within:border-primary ${error ? "border-destructive" : "border-slate-200"}`}>
          <input autoFocus value={code} onChange={(e) => { setCode(e.target.value); setError(""); }}
            placeholder="Địa chỉ truy cập cửa hàng" autoComplete="organization" spellCheck={false}
            className="h-12 flex-1 bg-transparent text-base outline-none" />
        </div>
        {error && <p className="-mt-3 text-sm text-destructive">{error}</p>}
        <p className="text-sm text-slate-600">Địa chỉ truy cập do quản trị cửa hàng cung cấp (Thiết lập → Thông tin cửa hàng).</p>
        <div className="flex justify-end">
          <Button type="submit" size="lg" className="h-11 rounded-xl px-6 text-base" disabled={loading}>{loading ? "Đang kiểm tra..." : "Vào cửa hàng"}</Button>
        </div>
      </form>
    </div>
  );
}
