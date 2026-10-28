"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChartLine, Eye, EyeOff, ShoppingCart, Store, Syringe } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { lookupStore, STORE_KEY, type StoreBrand } from "@/features/auth/store-access-dialog";

/**
 * Bước 2 đăng nhập (sau khi nhập địa chỉ cửa hàng): tên đăng nhập, mật khẩu, "Duy trì đăng nhập",
 * hai nút vào thẳng trang Quản lý hoặc màn Bán hàng.
 */
function Login() {
  const router = useRouter();
  const params = useSearchParams();
  const [store, setStore] = useState<StoreBrand | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState<"manage" | "pos" | null>(null);

  // Địa chỉ cửa hàng: từ URL, hoặc lần đăng nhập trước; không có / sai → quay về hộp nhập địa chỉ
  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(STORE_KEY); } catch { /* không đọc được: dùng URL */ }
    const code = params.get("store") ?? saved;
    if (!code) { router.replace("/welcome?login=1"); return; }
    lookupStore(code).then(setStore).catch(() => {
      try { localStorage.removeItem(STORE_KEY); } catch { /* bỏ qua */ }
      router.replace("/welcome?login=1");
    });
  }, [params, router]);

  async function login(target: "manage" | "pos") {
    if (!username || !password) { setError("Nhập tên đăng nhập và mật khẩu"); return; }
    setLoading(target);
    setError(null);
    const res = await fetch("/api/session/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, remember }),
    });
    if (res.ok) {
      router.replace(target === "pos" ? "/pos" : "/");
      router.refresh();
      return;
    }
    setLoading(null);
    const err = await res.json().catch(() => ({}));
    setError(err.message ?? "Đăng nhập thất bại");
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-900 p-4">
      {/* Nền: mảng màu mờ (không dùng ảnh bên ngoài) */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-32 size-[32rem] rounded-full bg-sky-500/30 blur-3xl" />
        <div className="absolute -bottom-40 right-0 size-[36rem] rounded-full bg-emerald-500/25 blur-3xl" />
        <div className="absolute left-1/3 top-1/2 size-80 rounded-full bg-indigo-500/20 blur-3xl" />
      </div>
      <form className="relative w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-2xl" onSubmit={(e) => { e.preventDefault(); void login("manage"); }}>
        <div className="space-y-3 px-6 pb-5 pt-6">
          <div className="flex flex-col items-center gap-1 pb-2">
            {store?.logo
              // eslint-disable-next-line @next/next/no-img-element -- logo cửa hàng dạng data URL
              ? <img src={store.logo} alt="" className="max-h-12 max-w-40 object-contain" />
              : <Syringe className="size-9 text-primary" />}
            <p className="text-center font-semibold text-slate-800">{store?.name ?? "..."}</p>
          </div>
          <input autoFocus value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Tên đăng nhập" autoComplete="username"
            className="h-10 w-full rounded-md border px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
          <div className="relative">
            <input type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mật khẩu"
              autoComplete="current-password" className="h-10 w-full rounded-md border px-3 pr-10 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
            <button type="button" tabIndex={-1} aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"} onClick={() => setShow(!show)}
              className="absolute right-3 top-2.5 text-slate-500">{show ? <Eye className="size-4" /> : <EyeOff className="size-4" />}</button>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <label className="flex items-center gap-1.5"><Checkbox checked={remember} onCheckedChange={(v) => setRemember(v === true)} /> Duy trì đăng nhập</label>
            <span className="text-slate-300">|</span>
            <button type="button" className="text-primary hover:underline"
              onClick={() => setNotice("Liên hệ quản trị cửa hàng để đặt lại mật khẩu (Thiết lập → Quản lý người dùng → chọn tài khoản).")}>Quên mật khẩu?</button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {notice && <p className="rounded-md bg-sky-50 p-2 text-xs text-sky-800">{notice}</p>}
        </div>
        <div className="grid grid-cols-2">
          <button type="submit" disabled={!!loading || !store}
            className="flex h-12 items-center justify-center gap-2 bg-primary font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
            <ChartLine className="size-4" /> {loading === "manage" ? "Đang vào..." : "Quản lý"}</button>
          <button type="button" disabled={!!loading || !store} onClick={() => void login("pos")}
            className="flex h-12 items-center justify-center gap-2 bg-emerald-600 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
            <ShoppingCart className="size-4" /> {loading === "pos" ? "Đang vào..." : "Bán hàng"}</button>
        </div>
      </form>
      <button type="button" onClick={() => router.push("/welcome?login=1")}
        className="relative mt-6 flex items-center gap-1.5 text-sm text-white/80 hover:text-white"><Store className="size-4" /> Đổi cửa hàng</button>
    </main>
  );
}

export default function LoginPage() {
  return <Suspense><Login /></Suspense>;
}
