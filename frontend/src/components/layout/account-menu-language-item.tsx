"use client";

import { useState } from "react";
import { Check, ChevronRight, Languages } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { LOCALES, LOCALE_INFO, useLocale, useSetLocale, useT, type Locale } from "@/lib/i18n";
import { navNs } from "@/messages/nav";
import { AccountMenuSubPanel } from "./account-menu-sub-panel";
import { LocaleFlagIcon } from "./locale-flag-icon";

const ROW = "flex h-9 w-full items-center gap-2.5 px-3 text-left text-[13px] hover:bg-muted";

/**
 * Mục "Ngôn ngữ" của menu tài khoản (truyền qua extraItems, nằm trên "Chủ đề"), hiện tên ngôn ngữ đang dùng.
 * Bấm → bảng "‹ Chọn ngôn ngữ" (ảnh 189): cờ + tên, ✓ ở ngôn ngữ đang dùng; Tiếng Việt / English ở trên,
 * nhóm "Bản thử nghiệm" bên dưới (日本語, 中文). Chọn xong lưu theo thiết bị và cả app đổi ngay, menu đóng lại.
 */
export function AccountMenuLanguageItem() {
  const t = useT(navNs);
  const locale = useLocale();
  const setLocale = useSetLocale();
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <DropdownMenuItem className="h-9 gap-2.5 px-3 text-[13px]" closeOnClick={false} onClick={() => setOpen(true)}>
        <Languages className="size-4" /> <span className="flex-1">{t("account.language")}</span>
        <span className="text-[12px] text-muted-foreground">{LOCALE_INFO[locale].nativeName}</span>
        <ChevronRight className="size-4 text-muted-foreground" />
      </DropdownMenuItem>
    );
  }

  const row = (l: Locale) => (
    <DropdownMenuItem key={l} className={ROW} lang={LOCALE_INFO[l].htmlLang}
      onClick={() => { if (l !== locale) setLocale(l); setOpen(false); }}>
      <LocaleFlagIcon locale={l} />
      <span className="flex-1">{LOCALE_INFO[l].nativeName}</span>
      {l === locale && <Check className="size-4 text-primary" />}
    </DropdownMenuItem>
  );

  return (
    <AccountMenuSubPanel title={t("account.chooseLanguage")} onBack={() => setOpen(false)}>
      {LOCALES.filter((l) => !LOCALE_INFO[l].beta).map(row)}
      <div className="mt-1 border-t px-3 pt-2 pb-1 text-[12px] text-muted-foreground" title={t("account.betaHint")}>
        {t("account.beta")}
      </div>
      {LOCALES.filter((l) => LOCALE_INFO[l].beta).map(row)}
    </AccountMenuSubPanel>
  );
}
