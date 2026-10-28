"use client";

import { Check, ChevronDown } from "lucide-react";
import { LocaleFlagIcon } from "@/components/layout/locale-flag-icon";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LOCALES, LOCALE_INFO, useLocale, useSetLocale, useT, type Locale } from "@/lib/i18n";
import { authNs } from "@/messages/auth";
import { navNs } from "@/messages/nav";

/** Chọn ngôn ngữ ở chân màn đăng nhập (chưa có menu tài khoản): cờ + tên, nhóm "Bản thử nghiệm" như menu tài khoản. */
export function LoginLanguageSelect() {
  const t = useT(authNs);
  const tn = useT(navNs);
  const locale = useLocale();
  const setLocale = useSetLocale();
  const item = (l: Locale) => (
    <DropdownMenuItem key={l} lang={LOCALE_INFO[l].htmlLang} className="gap-2 text-[13px]" onClick={() => setLocale(l)}>
      <LocaleFlagIcon locale={l} /> <span className="flex-1">{LOCALE_INFO[l].nativeName}</span>
      {l === locale && <Check className="size-4 text-primary" />}
    </DropdownMenuItem>
  );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label={t("login.language")} className="flex items-center gap-1.5 hover:underline">
        <LocaleFlagIcon locale={locale} /> {LOCALE_INFO[locale].nativeName} <ChevronDown className="ml-6 size-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end" className="w-48">
        {LOCALES.filter((l) => !LOCALE_INFO[l].beta).map(item)}
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-[12px] font-normal text-muted-foreground" title={tn("account.betaHint")}>
            {tn("account.beta")}
          </DropdownMenuLabel>
          {LOCALES.filter((l) => LOCALE_INFO[l].beta).map(item)}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
