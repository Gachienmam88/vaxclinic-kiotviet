"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Settings, Syringe, UserRound } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrentUser } from "@/lib/use-current-user";
import { cn } from "@/lib/utils";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "VaxClinic";

type NavItem = { href: string; label: string; perm?: string; children?: { href: string; label: string }[] };

/** Module chính trên thanh menu xanh. Thêm dần khi từng phase hoàn thành. */
const NAV: NavItem[] = [
  { href: "/", label: "Tổng quan" },
  { href: "/products", label: "Hàng hóa", perm: "catalog.view" },
  {
    href: "/purchases", label: "Mua hàng", perm: "inventory.view",
    children: [
      { href: "/purchases/receipts", label: "Nhập hàng" },
      { href: "/purchases/returns", label: "Trả hàng nhập" },
      { href: "/purchases/suppliers", label: "Nhà cung cấp" },
    ],
  },
  { href: "/invoices", label: "Đơn hàng", perm: "sales.perform", children: [{ href: "/invoices", label: "Hóa đơn" }] },
  { href: "/customers", label: "Khách hàng", perm: "patient.view" },
  { href: "/cashbook", label: "Sổ quỹ", perm: "cashbook.manage" },
];

const navClass = (active: boolean) =>
  cn("rounded-md px-4 py-1.5 text-sm font-semibold hover:bg-black/10", active && "bg-black/20");

/** Thanh trên (trắng): logo + cài đặt + tài khoản. Thanh dưới (xanh): menu module. */
export function AppHeader() {
  const pathname = usePathname();
  const { data: me, can } = useCurrentUser();

  async function logout() {
    await fetch("/api/session/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <header className="sticky top-0 z-40 shadow-sm">
      <div className="flex h-12 items-center gap-4 bg-background px-4 md:px-10">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold text-primary">
          <Syringe className="size-6" /> {APP_NAME}
        </Link>
        <div className="ml-auto flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger className="rounded-md p-2 hover:bg-muted" aria-label="Thiết lập">
              <Settings className="size-5 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Thiết lập</DropdownMenuLabel>
                {can("user.manage") && (
                  <DropdownMenuItem render={<Link href="/settings/users" />}>Người dùng</DropdownMenuItem>
                )}
                <DropdownMenuItem render={<Link href="/settings/branches" />}>Điểm tiêm (chi nhánh)</DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
              <span className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <UserRound className="size-4" />
              </span>
              <span className="hidden sm:inline">{me?.user.fullName ?? "..."}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuLabel>{me?.user.roleName}</DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout}>
                <LogOut className="size-4" /> Đăng xuất
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <nav className="flex h-10 items-center gap-1 bg-primary px-4 text-primary-foreground md:px-10">
        {NAV.filter((item) => !item.perm || can(item.perm)).map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          if (item.children) {
            return (
              <DropdownMenu key={item.href}>
                <DropdownMenuTrigger className={navClass(active)}>{item.label}</DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {item.children.map((c) => (
                    <DropdownMenuItem key={c.href} render={<Link href={c.href} />}>{c.label}</DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          }
          return <Link key={item.href} href={item.href} className={navClass(active)}>{item.label}</Link>;
        })}
        {can("sales.perform") && (
          <Link href="/pos" className="ml-auto flex items-center gap-2 rounded-md bg-background px-4 py-1.5 text-sm font-semibold text-primary hover:bg-background/90">
            <ShoppingCart className="size-4" /> Bán hàng
          </Link>
        )}
      </nav>
    </header>
  );
}
