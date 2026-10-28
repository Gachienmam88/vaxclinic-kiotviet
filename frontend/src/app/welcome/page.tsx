"use client";

import { useEffect, useState } from "react";
import { Play, Syringe } from "lucide-react";
import { StoreAccessDialog } from "@/features/auth/store-access-dialog";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "VaxClinic";

/** Ảnh bên phải: file public/brand/hero.jpg (ảnh của cửa hàng); chưa có → khung màn hình vẽ bằng CSS. */
function HeroImage() {
  const [ok, setOk] = useState(true);
  return (
    <div className="flex h-[350px] items-end justify-center overflow-hidden rounded-[28px] bg-[#c9e3c1]">
      {ok
        // eslint-disable-next-line @next/next/no-img-element -- ảnh tĩnh của cửa hàng, có thể chưa có
        ? <img src="/brand/hero.jpg" alt="" className="h-full w-full object-cover" onError={() => setOk(false)} />
        : (
          <div className="mb-10 w-[310px] rounded-lg border-[7px] border-[#2b2f36] bg-white shadow-2xl">
            <div className="flex h-6 items-center gap-1 bg-primary px-2 text-[10px] font-bold text-white"><Syringe className="size-3" /> {APP_NAME}</div>
            <div className="space-y-1.5 p-2">
              {["Vắc xin Rotateq", "Vắc xin Hexaxim", "Vắc xin Varivax", "Vắc xin Gardasil 9"].map((n) => (
                <div key={n} className="flex h-5 items-center rounded bg-[#f3f4f6] px-2 text-[10px]">{n}<span className="ml-auto h-1.5 w-10 rounded bg-primary/40" /></div>
              ))}
            </div>
          </div>
        )}
    </div>
  );
}

/**
 * Trang giới thiệu (chưa đăng nhập) — bố cục theo trang chủ KiotViet (ảnh 1365px): thanh trên cao 88px,
 * tiêu đề 46px đậm 2 dòng, mô tả 18px, 2 nút bo tròn cao 64px, ảnh bên phải bo 28px. ?login=1 → mở hộp địa chỉ cửa hàng.
 */
export default function WelcomePage() {
  const [login, setLogin] = useState(false);
  // Đọc tham số sau khi tải trang (không dùng useSearchParams để trang được dựng sẵn, hiện ngay)
  useEffect(() => { if (new URLSearchParams(window.location.search).get("login") === "1") setLogin(true); }, []);
  return (
    <div className="min-h-screen bg-[#f0f2f5] text-[#111827]">
      <header className="border-b border-[#e5e7eb] bg-white">
        <div className="mx-auto flex h-[88px] max-w-[1270px] items-center px-4">
          <span className="flex items-center gap-2 text-[28px] font-bold text-[#0a2540]"><Syringe className="size-9 text-primary" /> {APP_NAME}</span>
          <nav className="ml-16 hidden items-center gap-10 text-[16px] font-medium text-[#1f2937] lg:flex">
            <a href="#tinh-nang" className="hover:text-primary">Tính năng</a>
            <a href="#nganh-hang" className="hover:text-primary">Ngành hàng</a>
            <a href="#ho-tro" className="hover:text-primary">Hỗ trợ</a>
          </nav>
          <div className="ml-auto flex items-center gap-6">
            <span className="hidden h-6 border-l border-[#d1d5db] lg:block" />
            <button type="button" className="text-[16px] font-medium hover:text-primary" onClick={() => setLogin(true)}>Đăng nhập</button>
            <button type="button" className="h-10 rounded-full bg-primary px-5 text-[16px] font-semibold text-white hover:bg-primary-hover" onClick={() => setLogin(true)}>Vào cửa hàng</button>
          </div>
        </div>
      </header>
      <main className="mx-auto grid max-w-[1270px] grid-cols-1 items-center gap-10 px-4 pb-16 pt-[95px] lg:grid-cols-[1fr_485px]">
        <div>
          <h1 className="text-[46px] font-bold leading-[1.27] tracking-[-0.01em]">Phần mềm quản lý<br />phòng tiêm chủng</h1>
          <p className="mt-5 max-w-[580px] text-[18px] leading-7 text-[#1f2937]">Bán vắc xin, kho theo lô – hạn dùng, công nợ, sổ quỹ, hóa đơn điện tử và sổ sách thuế cho mọi chi nhánh.</p>
          <div className="mt-12 flex flex-wrap gap-4">
            <button type="button" onClick={() => setLogin(true)}
              className="h-16 w-[275px] rounded-full bg-primary text-[23px] font-bold text-white hover:bg-primary-hover">Đăng nhập</button>
            <a href="#tinh-nang" className="flex h-16 items-center gap-3 rounded-full bg-white pl-8 pr-2.5 text-[23px] font-bold text-primary">
              Khám phá <span className="flex size-11 items-center justify-center rounded-full border-2 border-primary"><Play className="ml-0.5 size-5 fill-primary" /></span></a>
          </div>
        </div>
        <HeroImage />
      </main>
      <section id="tinh-nang" className="mx-auto grid max-w-[1270px] gap-4 px-4 pb-16 md:grid-cols-3">
        {[["Kho vắc xin theo lô, hạn dùng", "Hết hạn trước xuất trước, không bán lô đã hết hạn."],
          ["Bán hàng khi mất mạng", "Quầy thu ngân vẫn chạy, có mạng tự đồng bộ."],
          ["Hóa đơn điện tử & thuế", "Kết nối MISA, sổ sách và tờ khai hộ kinh doanh."]].map(([t, d]) => (
          <div key={t} className="rounded-2xl bg-white p-6"><h3 className="text-[18px] font-semibold">{t}</h3><p className="mt-1 text-[15px] text-[#4b5563]">{d}</p></div>
        ))}
      </section>
      <footer id="ho-tro" className="border-t bg-white py-6 text-center text-[14px] text-[#6b7280]">Cần hỗ trợ, liên hệ quản trị hệ thống của doanh nghiệp.</footer>
      {login && <StoreAccessDialog onClose={() => setLogin(false)} />}
    </div>
  );
}
