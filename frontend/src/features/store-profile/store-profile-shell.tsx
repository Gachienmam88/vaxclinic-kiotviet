"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleUserRound, FileClock, FilePen, Files } from "lucide-react";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { storeProfileNs } from "@/messages/store-profile";

type NavItem = { href: string; label: "storeInfo" | "einvoice" | "certificates" | "terms"; icon: typeof Files };

/**
 * Menu trái "Hồ sơ cửa hàng" (KiotViet /man/#/KmaManagement). Chỉ giữ các mục có thật trong hệ thống nội bộ:
 * các mục Gói dịch vụ / Lịch sử mua hàng / Bản xác nhận dịch vụ / Thanh toán / Giới thiệu khách hàng là dịch vụ thu phí
 * của chính KiotViet nên không có ở đây.
 */
const GROUPS: { title: "store" | "einvoice" | "other"; items: NavItem[] }[] = [
  { title: "store", items: [{ href: "/store-profile", label: "storeInfo", icon: CircleUserRound }] },
  {
    title: "einvoice",
    items: [
      { href: "/store-profile/einvoice", label: "einvoice", icon: FileClock },
      { href: "/store-profile/certificates", label: "certificates", icon: FilePen },
    ],
  },
  { title: "other", items: [{ href: "/store-profile/terms", label: "terms", icon: Files }] },
];

/** Khung trang: menu nhóm 250px bên trái, nội dung bên phải (cách 12px). */
export function StoreProfileShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const t = useT(storeProfileNs);
  return (
    <div className="flex items-start gap-3">
      <nav aria-label={t("shell.navLabel")} className="sticky top-28 w-[250px] shrink-0 rounded-lg bg-background px-2 py-1.5">
        {GROUPS.map((g, gi) => (
          <div key={g.title} className={cn("py-2", gi > 0 && "border-t border-border")}>
            <p className="px-3 pt-1 pb-2.5 text-xs font-medium text-muted-foreground">{t(`shell.groups.${g.title}`)}</p>
            {g.items.map((i) => {
              const active = i.href === "/store-profile" ? pathname === i.href : pathname.startsWith(i.href);
              return (
                <Link key={i.href} href={i.href} aria-current={active ? "page" : undefined}
                  className={cn("flex h-11 items-center gap-3 rounded-md px-3 text-[13px] hover:bg-muted",
                    active && "bg-primary/10 font-medium text-primary hover:bg-primary/10")}>
                  <i.icon className="size-[18px] shrink-0" strokeWidth={1.6} /> {t(`shell.items.${i.label}`)}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** Thẻ trắng nội dung (bo 8px) như các khối bên phải màn KiotViet. */
export function ProfileCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn("rounded-lg bg-background", className)}>{children}</section>;
}

/** Ô thông tin chỉ đọc: nhãn 11px xám trên, giá trị 13px dưới, gạch chân mảnh (ảnh 177 / 187). */
export function InfoField({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0 border-b border-border pb-2", className)}>
      <div className="mb-1.5 text-[11px] text-muted-foreground">{label}</div>
      <div className="min-h-5 truncate text-[13px]">{value || <span className="text-muted-foreground">—</span>}</div>
    </div>
  );
}
