"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrentUser } from "@/lib/use-current-user";
import { cn } from "@/lib/utils";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "VaxClinic";

/** Top-level modules. New modules are added here as their phases are delivered. */
const NAV: { href: string; label: string; perm?: string }[] = [
  { href: "/", label: "Tổng quan" },
  { href: "/settings/users", label: "Người dùng", perm: "user.manage" },
  { href: "/settings/branches", label: "Điểm tiêm" },
];

export function AppHeader() {
  const pathname = usePathname();
  const { data: me, can } = useCurrentUser();

  async function logout() {
    await fetch("/api/session/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <header className="sticky top-0 z-40 bg-primary text-primary-foreground shadow">
      <div className="flex h-12 items-center gap-6 px-4">
        <Link href="/" className="text-lg font-bold">{APP_NAME}</Link>
        <nav className="flex h-full items-stretch">
          {NAV.filter((item) => !item.perm || can(item.perm)).map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href}
                className={cn("flex items-center px-3 text-sm font-medium hover:bg-white/10",
                  active && "bg-white/20")}>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-white/10" />}>
              <UserRound className="size-4" /> {me?.user.fullName ?? "..."}
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
    </header>
  );
}
