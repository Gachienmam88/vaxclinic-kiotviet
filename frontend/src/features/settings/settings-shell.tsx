"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight, Building2, FileText, Lock, MapPin, Package, Search, Store, UserCog, UserRound, Wallet,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useCurrentUser } from "@/lib/use-current-user";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: typeof Package; keywords: string; perm?: string };

/** Menu trái của Thiết lập. keywords: để ô "Tìm kiếm thiết lập" tìm được theo tên từng thiết lập con. */
const GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Quản lý",
    items: [
      { href: "/settings/products", label: "Hàng hóa", icon: Package, keywords: "nhóm hàng vị trí giá vốn tồn kho" },
      { href: "/settings/orders", label: "Đơn hàng", icon: ArrowLeftRight,
        keywords: "giao dịch hết tồn kho âm kho trả hàng thời gian hóa đơn điện tử hđđt mã giao dịch" },
      { href: "/settings/customers", label: "Khách hàng", icon: UserRound, keywords: "thông tin bắt buộc cảnh báo công nợ" },
      { href: "/settings/bank-accounts", label: "Sổ quỹ", icon: Wallet, keywords: "tài khoản ngân hàng thu chi qr", perm: "cashbook.manage" },
      { href: "/settings/einvoice", label: "Hóa đơn điện tử", icon: FileText, keywords: "misa meinvoice", perm: "user.manage" },
    ],
  },
  {
    title: "Cửa hàng",
    items: [
      { href: "/settings/store", label: "Thông tin cửa hàng", icon: Store, keywords: "tên địa chỉ điện thoại logo ảnh đại diện" },
      { href: "/settings/users", label: "Quản lý người dùng", icon: UserCog, keywords: "tài khoản vai trò phân quyền", perm: "user.manage" },
      { href: "/settings/branches", label: "Quản lý chi nhánh", icon: MapPin, keywords: "điểm tiêm chi nhánh" },
    ],
  },
  {
    title: "Dữ liệu",
    items: [{ href: "/settings/lock", label: "Khóa sổ", icon: Lock, keywords: "ngày khóa sổ báo cáo" }],
  },
];

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").toLowerCase();

/** Khung trang Thiết lập: tiêu đề + tìm kiếm, menu nhóm bên trái, nội dung bên phải. */
export function SettingsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { can } = useCurrentUser();
  const [q, setQ] = useState("");
  const query = norm(q.trim());
  const groups = GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => (!i.perm || can(i.perm)) && (!query || norm(`${i.label} ${i.keywords}`).includes(query))),
  })).filter((g) => g.items.length);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <h1 className="w-56 shrink-0 text-xl font-bold">Thiết lập</h1>
        <div className="relative w-80">
          <Search className="absolute top-2 left-2.5 size-4 text-muted-foreground" />
          <Input className="bg-background pl-8" placeholder="Tìm kiếm thiết lập" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <div className="flex items-start gap-4">
        <nav className="sticky top-28 w-56 shrink-0 rounded-lg bg-background p-2 text-sm">
          {!groups.length && <p className="p-3 text-muted-foreground">Không tìm thấy thiết lập</p>}
          {groups.map((g, gi) => (
            <div key={g.title} className={cn("py-1", gi > 0 && "border-t")}>
              <p className="px-3 pt-2 pb-1 text-xs font-semibold text-muted-foreground">{g.title}</p>
              {g.items.map((i) => (
                <Link key={i.href} href={i.href}
                  className={cn("flex items-center gap-3 rounded-md px-3 py-2 hover:bg-muted",
                    pathname.startsWith(i.href) && "bg-primary/10 font-medium text-primary")}>
                  <i.icon className="size-4" /> {i.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

/** Thẻ nhóm thiết lập (VD "Quản lý đơn hàng"); id dùng cho mục lục bên phải. */
export function SettingsCard({ id, title, description, action, children }: {
  id?: string; title: string; description?: React.ReactNode; action?: React.ReactNode; children?: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28 rounded-lg bg-background">
      <div className="flex items-start gap-3 border-b px-5 py-4">
        <div className="flex-1">
          <h2 className="font-semibold">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Một dòng thiết lập: tiêu đề + mô tả bên trái, nút gạt / giá trị bên phải, phần mở rộng bên dưới. */
export function SettingRow({ title, description, control, children }: {
  title: string; description?: React.ReactNode; control?: React.ReactNode; children?: React.ReactNode;
}) {
  return (
    <div className="border-b px-5 py-3 last:border-0">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <p className="text-sm font-medium">{title}</p>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {control}
      </div>
      {children}
    </div>
  );
}

/** Trang thiết lập có mục lục bên phải (giống KiotViet). */
export function SettingsPage({ toc, children }: { toc: { id: string; label: string }[]; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4">
      <div className="min-w-0 flex-1 space-y-4">{children}</div>
      <aside className="sticky top-28 hidden w-44 shrink-0 rounded-lg bg-background p-3 text-sm xl:block">
        {toc.map((t) => (
          <a key={t.id} href={`#${t.id}`} className="block border-l-2 border-transparent py-1 pl-3 text-muted-foreground hover:border-primary hover:text-primary">
            {t.label}
          </a>
        ))}
      </aside>
    </div>
  );
}

export { Building2 };
