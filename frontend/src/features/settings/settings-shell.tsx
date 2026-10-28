"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight, FileText, History, Printer, QrCode, Receipt, Lock, MapPin, Megaphone, Package, Search, Store, UserCog, UserRound, Wallet,
} from "lucide-react";
import { useT } from "@/lib/i18n";
import { useCurrentUser } from "@/lib/use-current-user";
import { cn } from "@/lib/utils";
import { settingsNs } from "@/messages/settings";
import viSettings from "@/messages/vi/settings.json";

type ItemKey = keyof typeof viSettings.shell.items;
type GroupKey = keyof typeof viSettings.shell.groups;
/** label/title: khóa trong settings.json (shell.items / shell.groups); keywords: tiếng Việt, luôn tìm được ở mọi ngôn ngữ. */
type NavItem = { href: string; label: ItemKey; icon: typeof Package; keywords: string; perm?: string };

/** Menu trái của Thiết lập. keywords: để ô "Tìm kiếm thiết lập" tìm được theo tên từng thiết lập con. */
const GROUPS: { title: GroupKey; items: NavItem[] }[] = [
  {
    title: "manage",
    items: [
      { href: "/settings/products", label: "products", icon: Package, keywords: "nhóm hàng vị trí giá vốn tồn kho" },
      { href: "/settings/orders", label: "orders", icon: ArrowLeftRight,
        keywords: "giao dịch hết tồn kho âm kho trả hàng thời gian hóa đơn điện tử hđđt mã giao dịch" },
      { href: "/settings/customers", label: "customers", icon: UserRound, keywords: "thông tin bắt buộc cảnh báo công nợ" },
      { href: "/settings/bank-accounts", label: "cashbook", icon: Wallet, keywords: "tài khoản ngân hàng thu chi qr", perm: "cashbook.manage" },
      { href: "/settings/tax", label: "tax", icon: Receipt, keywords: "thuế vat gtgt tncn hồ sơ kê khai mã số thuế địa điểm kinh doanh" },
      { href: "/settings/einvoice", label: "einvoice", icon: FileText, keywords: "misa meinvoice", perm: "user.manage" },
      { href: "/settings/print-templates", label: "printTemplates", icon: Printer, keywords: "in hóa đơn phiếu thu chi a5" },
    ],
  },
  {
    title: "utilities",
    items: [
      { href: "/settings/payments", label: "payments", icon: QrCode, keywords: "sepay báo có qr chuyển khoản ngân hàng webhook" },
      { href: "/settings/notifications", label: "notifications", icon: Megaphone,
        keywords: "hộp thư đến cảnh báo hết hạn lô tồn kho tối thiểu thông báo cập nhật", perm: "settings.manage" },
    ],
  },
  {
    title: "store",
    items: [
      { href: "/settings/store", label: "store", icon: Store, keywords: "tên địa chỉ điện thoại logo ảnh đại diện" },
      { href: "/settings/users", label: "users", icon: UserCog, keywords: "tài khoản vai trò phân quyền", perm: "user.manage" },
      { href: "/settings/branches", label: "branches", icon: MapPin, keywords: "điểm tiêm chi nhánh" },
    ],
  },
  {
    title: "data",
    items: [
      { href: "/settings/lock", label: "lock", icon: Lock, keywords: "ngày khóa sổ báo cáo" },
      { href: "/settings/audit-logs", label: "auditLogs", icon: History, keywords: "nhật ký nhân viên thao tác", perm: "user.manage" },
    ],
  },
];

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").toLowerCase();

/** Khung trang Thiết lập: tiêu đề 18px + ô tìm kiếm 296px, menu nhóm 200px bên trái, nội dung bên phải. */
export function SettingsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { can } = useCurrentUser();
  const t = useT(settingsNs);
  const [q, setQ] = useState("");
  const query = norm(q.trim());
  const groups = GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => (!i.perm || can(i.perm)) && (!query || norm(`${t(`shell.items.${i.label}`)} ${viSettings.shell.items[i.label]} ${i.keywords}`).includes(query))),
  })).filter((g) => g.items.length);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2.5">
        <h1 className="w-[200px] shrink-0 text-lg font-bold">{t("shell.title")}</h1>
        <div className="relative w-[296px]">
          <Search className="absolute top-[5px] left-2 size-4 text-muted-foreground" />
          <input aria-label={t("shell.search")} placeholder={t("shell.search")} value={q} onChange={(e) => setQ(e.target.value)}
            className="h-[26px] w-full rounded-md border border-[#d5d9df] bg-background pr-2 pl-8 text-xs outline-none placeholder:text-muted-foreground focus:border-primary" />
        </div>
      </div>
      <div className="flex items-start gap-2.5">
        <nav aria-label={t("shell.title")} className="sticky top-28 w-[200px] shrink-0 rounded-lg bg-background px-[7px] py-1.5">
          {!groups.length && <p className="p-3 text-[13px] text-muted-foreground">{t("shell.noResults")}</p>}
          {groups.map((g, gi) => (
            <div key={g.title} className={cn("py-1.5", gi > 0 && "border-t border-[#eceef1]")}>
              <p className="px-2.5 pt-1.5 pb-2 text-[11px] font-medium text-muted-foreground">{t(`shell.groups.${g.title}`)}</p>
              {g.items.map((i) => {
                const active = pathname.startsWith(i.href);
                return (
                  <Link key={i.href} href={i.href} aria-current={active ? "page" : undefined}
                    className={cn("flex h-9 items-center gap-3 rounded-md px-2.5 text-[13px] hover:bg-[#f3f6fa]",
                      active && "bg-primary-tint text-primary hover:bg-primary-tint")}>
                    <i.icon className="size-[18px] shrink-0" strokeWidth={1.6} /> {t(`shell.items.${i.label}`)}
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

export { SettingRow, SettingsCard, SettingsHint, SettingsPage, SETTINGS_TABLE, SETTINGS_TABS, StatusPill } from "./settings-layout-parts";
