"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarCheck, PackageCheck, ShieldCheck, Syringe, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StoreAccessDialog } from "@/features/auth/store-access-dialog";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "VaxClinic";

const FEATURES = [
  { icon: PackageCheck, title: "Kho vắc xin theo lô, hạn dùng", text: "Hết hạn trước xuất trước, không bán lô đã hết hạn." },
  { icon: WifiOff, title: "Bán hàng khi mất mạng", text: "Quầy thu ngân vẫn chạy, có mạng tự đồng bộ." },
  { icon: ShieldCheck, title: "Hóa đơn điện tử & thuế", text: "Kết nối MISA, sổ sách và tờ khai hộ kinh doanh." },
];

/** Minh họa bên phải: khung màn hình quản lý vẽ bằng CSS (không dùng ảnh bên ngoài). */
function Illustration() {
  return (
    <div className="relative rounded-3xl bg-gradient-to-br from-sky-100 to-emerald-100 p-8">
      <div className="rounded-xl border-8 border-slate-800 bg-white shadow-2xl">
        <div className="flex items-center gap-2 bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"><Syringe className="size-4" /> {APP_NAME}</div>
        <div className="space-y-2 p-3">
          {[["Rotateq", "Lô RT2601", "665.000"], ["Hexaxim", "Lô HX2512", "1.015.000"], ["Varivax", "Lô VX2602", "900.000"]].map(([n, l, p]) => (
            <div key={n} className="flex items-center gap-2 rounded-md bg-slate-50 px-2 py-1.5 text-xs">
              <span className="font-medium">Vắc xin {n}</span><span className="text-slate-500">{l}</span><span className="ml-auto font-semibold text-primary">{p}</span>
            </div>
          ))}
          <div className="flex justify-end"><span className="rounded bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">THANH TOÁN</span></div>
        </div>
      </div>
      <div className="absolute -right-3 top-6 hidden w-44 rounded-xl bg-white p-3 text-xs shadow-xl md:block">
        <p className="mb-1 flex items-center gap-1 font-semibold"><CalendarCheck className="size-3.5 text-emerald-600" /> Hẹn tiêm hôm nay</p>
        {["Nguyễn Minh An · 08:30", "Trần Bảo Ngọc · 09:15", "Lê Gia Huy · 10:00"].map((x) => <p key={x} className="text-slate-600">{x}</p>)}
      </div>
    </div>
  );
}

function Welcome() {
  const params = useSearchParams();
  const [login, setLogin] = useState(params.get("login") === "1");
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
          <span className="flex items-center gap-2 text-xl font-bold text-primary"><Syringe className="size-7" /> {APP_NAME}</span>
          <nav className="hidden gap-6 text-sm font-medium text-slate-700 md:flex">
            <a href="#tinh-nang" className="hover:text-primary">Tính năng</a><a href="#lien-he" className="hover:text-primary">Hỗ trợ</a>
          </nav>
          <button type="button" className="ml-auto text-sm font-semibold text-slate-800 hover:text-primary" onClick={() => setLogin(true)}>Đăng nhập</button>
        </div>
      </header>
      <main className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 md:grid-cols-2">
        <div className="space-y-6">
          <h1 className="text-4xl font-extrabold leading-tight text-slate-900 md:text-5xl">Quản lý phòng tiêm chủng<br />gọn trong một phần mềm</h1>
          <p className="text-lg text-slate-600">Bán vắc xin, quản lý kho theo lô, công nợ, sổ quỹ, hóa đơn điện tử và sổ sách thuế — cho mọi điểm tiêm của doanh nghiệp.</p>
          <div className="flex gap-3">
            <Button size="lg" className="h-12 rounded-full px-8 text-base" onClick={() => setLogin(true)}>Đăng nhập</Button>
            <Button size="lg" variant="outline" className="h-12 rounded-full px-8 text-base" render={<a href="#tinh-nang" />}>Khám phá</Button>
          </div>
        </div>
        <Illustration />
      </main>
      <section id="tinh-nang" className="mx-auto grid max-w-6xl gap-4 px-4 pb-16 md:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-2xl bg-white p-5 shadow-sm">
            <f.icon className="size-8 text-primary" /><h3 className="mt-3 font-semibold">{f.title}</h3><p className="mt-1 text-sm text-slate-600">{f.text}</p>
          </div>
        ))}
      </section>
      <footer id="lien-he" className="border-t bg-white py-6 text-center text-sm text-slate-500">Cần hỗ trợ, liên hệ quản trị hệ thống của doanh nghiệp.</footer>
      {login && <StoreAccessDialog onClose={() => setLogin(false)} />}
    </div>
  );
}

/** Trang giới thiệu (chưa đăng nhập) → "Đăng nhập" mở hộp nhập địa chỉ cửa hàng. */
export default function WelcomePage() {
  return <Suspense><Welcome /></Suspense>;
}
