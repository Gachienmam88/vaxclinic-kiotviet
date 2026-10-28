"use client";

import Link from "next/link";
import { LogOut, Settings, ShoppingCart, Syringe, UserRound } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrentUser } from "@/lib/use-current-user";
import { CONTAINER } from "@/lib/layout";
import { cn } from "@/lib/utils";
import { AppHeaderNavMenu } from "./app-header-nav-menu";
import { NotificationBell } from "./notification-bell";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "VaxClinic";

/** Thanh trên (trắng): logo + cài đặt + tài khoản. Thanh dưới (xanh): menu module. */
export function AppHeader() {
  const { data: me, can } = useCurrentUser();

  async function logout() {
    await fetch("/api/session/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <header className="sticky top-0 z-40">
      <div className="bg-background">
        <div className={cn(CONTAINER, "flex h-[46px] items-center gap-4")}>
          <Link href="/" className="flex items-center gap-1.5 text-[19px] font-bold text-[#0a2540]">
            <Syringe className="size-7 text-primary" /> {APP_NAME}
          </Link>
          <div className="ml-auto flex items-center gap-3 text-[13px] text-foreground">
            <NotificationBell />
            <Link href="/settings" className="rounded-md p-1 hover:bg-muted" aria-label="Thiết lập" title="Thiết lập">
              <Settings className="size-[18px]" />
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger className="flex size-7 items-center justify-center rounded-full bg-[#e8f1fe] text-primary hover:bg-[#d6e6fd]"
                aria-label="Tài khoản" title={me?.user.fullName}>
                <UserRound className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>{me?.user.fullName}<span className="block text-xs font-normal text-muted-foreground">{me?.user.roleName}</span></DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout}>
                  <LogOut className="size-4" /> Đăng xuất
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
      <div className="bg-primary text-primary-foreground">
      <nav className={cn(CONTAINER, "flex h-[43px] items-center gap-0.5")}>
        <AppHeaderNavMenu can={can} />
        {can("sales.perform") && (
          <Link href="/sale" className="ml-auto flex h-[30px] w-[105px] items-center justify-center gap-2 rounded-md bg-background text-[13px] font-semibold text-primary hover:bg-background/90">
            <ShoppingCart className="size-4" /> Bán hàng
          </Link>
        )}
      </nav>
      </div>
    </header>
  );
}
