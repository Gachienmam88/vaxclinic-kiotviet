"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck, CalendarDays, CircleDollarSign, Fingerprint, Settings, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";

/** Menu trái "Thiết lập nhân viên" (ảnh KiotViet 116): Thiết lập / Tiện ích. "Zalo mini app" thay bằng Chấm công điện thoại. */
const GROUPS = [
  {
    title: "Thiết lập",
    items: [
      { href: "/employees/settings/start", label: "Khởi tạo", icon: Settings },
      { href: "/employees/settings/timekeeping", label: "Chấm công", icon: CalendarCheck },
      { href: "/employees/settings/payroll", label: "Tính lương", icon: CircleDollarSign },
      { href: "/employees/settings/workdays", label: "Ngày làm & Nghỉ", icon: CalendarDays },
    ],
  },
  {
    title: "Tiện ích",
    items: [
      { href: "/employees/settings/mobile", label: "Chấm công điện thoại", icon: Smartphone },
      { href: "/employees/settings/machine", label: "Máy chấm công", icon: Fingerprint },
    ],
  },
];

/** Khung trang Thiết lập nhân viên: tiêu đề 18px, menu 166px bên trái, nội dung bên phải. */
export function HrSettingsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="space-y-3">
      <h1 className="flex h-8 items-center text-lg font-bold">Thiết lập nhân viên</h1>
      <div className="flex items-start gap-2.5">
        <nav aria-label="Thiết lập nhân viên" className="sticky top-28 min-h-[490px] w-[166px] shrink-0 rounded-lg bg-background px-[3px] py-1.5">
          {GROUPS.map((g, gi) => (
            <div key={g.title} className={cn("py-1.5", gi > 0 && "border-t border-[#eceef1]")}>
              <p className="px-2.5 pt-1.5 pb-2 text-[12px] text-muted-foreground">{g.title}</p>
              {g.items.map((i) => {
                const active = pathname.startsWith(i.href);
                return (
                  <Link key={i.href} href={i.href} aria-current={active ? "page" : undefined}
                    className={cn("flex h-[26px] my-1.5 items-center gap-2.5 rounded-md px-3 text-[12px] hover:bg-[#f3f6fa]",
                      active && "bg-[#e5f0ff] text-primary hover:bg-[#e5f0ff]")}>
                    <i.icon className="size-[14px] shrink-0" strokeWidth={1.8} /> {i.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
