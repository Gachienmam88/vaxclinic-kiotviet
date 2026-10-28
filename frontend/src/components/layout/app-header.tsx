"use client";

import Link from "next/link";
import { Settings, ShoppingCart, Syringe } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useCurrentUser } from "@/lib/use-current-user";
import { CONTAINER } from "@/lib/layout";
import { cn } from "@/lib/utils";
import { navNs } from "@/messages/nav";
import { AccentThemeSync } from "./accent-theme-sync";
import { AccountMenuDropdown } from "./account-menu-dropdown";
import { AccountMenuLanguageItem } from "./account-menu-language-item";
import { AccountMenuThemeItem } from "./account-menu-theme-item";
import { AppHeaderNavMenu } from "./app-header-nav-menu";
import { NotificationBell } from "./notification-bell";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "VaxClinic";

/** Thanh trên (trắng): logo + cài đặt + tài khoản. Thanh dưới (màu "Chủ đề"): menu module. */
export function AppHeader() {
  const { can } = useCurrentUser();
  const t = useT(navNs);

  return (
    <header className="sticky top-0 z-40">
      <AccentThemeSync />
      <div className="bg-background">
        <div className={cn(CONTAINER, "flex h-[46px] items-center gap-4")}>
          <Link href="/" className="flex items-center gap-1.5 text-[19px] font-bold text-[#0a2540]">
            <Syringe className="size-7 text-primary" /> {APP_NAME}
          </Link>
          <div className="ml-auto flex items-center gap-3 text-[13px] text-foreground">
            <NotificationBell />
            <Link href="/settings" className="rounded-md p-1 hover:bg-muted" aria-label={t("header.settings")} title={t("header.settings")}>
              <Settings className="size-[18px]" />
            </Link>
            {/* extraItems: Ngôn ngữ (trên) + Chủ đề (màu giao diện) */}
            <AccountMenuDropdown extraItems={<><AccountMenuLanguageItem /><AccountMenuThemeItem /></>} />
          </div>
        </div>
      </div>
      <div className="bg-chrome text-white">
      <nav className={cn(CONTAINER, "flex h-[43px] items-center gap-0.5")}>
        <AppHeaderNavMenu can={can} />
        {can("sales.perform") && (
          <Link href="/sale" className="ml-auto flex h-[30px] w-[105px] items-center justify-center gap-2 rounded-md bg-background text-[13px] font-semibold text-chrome hover:bg-background/90">
            <ShoppingCart className="size-4" /> {t("menu.sale")}
          </Link>
        )}
      </nav>
      </div>
    </header>
  );
}
