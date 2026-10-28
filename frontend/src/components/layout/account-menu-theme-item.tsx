"use client";

import { useState } from "react";
import { Check, ChevronRight, Palette } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { ACCENTS, applyAccent, readAccent, saveAccent, type Accent } from "@/lib/accent-theme";
import { useT } from "@/lib/i18n";
import { useCurrentUser } from "@/lib/use-current-user";
import { navNs } from "@/messages/nav";
import { AccountMenuSubPanel } from "./account-menu-sub-panel";

type AccentId = keyof typeof navNs.vi.accents;

/**
 * Mục "Chủ đề" của menu tài khoản (truyền qua extraItems): bấm → bảng "‹ Chủ đề" lưới 3×3 ô màu (ảnh 190),
 * ô đang dùng có dấu ✓ trắng, bấm ô nào áp màu đó ngay và lưu theo người dùng.
 * Ô 50px ảnh → 67px, khe 9px → 12px (ảnh chụp zoom 67%, phần quản lý phóng 1.12).
 */
export function AccountMenuThemeItem() {
  const { data: me } = useCurrentUser();
  const t = useT(navNs);
  const userId = me?.user.id;
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<Accent | null>(null);

  function pick(accent: Accent) {
    applyAccent(accent);
    if (userId) saveAccent(userId, accent);
    setCurrent(accent);
  }

  if (!open) {
    return (
      <DropdownMenuItem className="h-9 gap-2.5 px-3 text-[13px]" closeOnClick={false}
        onClick={() => { setCurrent(userId ? readAccent(userId) : null); setOpen(true); }}>
        <Palette className="size-4" /> <span className="flex-1">{t("account.theme")}</span> <ChevronRight className="size-4 text-muted-foreground" />
      </DropdownMenuItem>
    );
  }

  return (
    <AccountMenuSubPanel title={t("account.theme")} onBack={() => setOpen(false)}>
      <div className="grid grid-cols-3 gap-3 px-3">
        {ACCENTS.map((a) => {
          const selected = current?.hex === a.hex;
          const label = t(`accents.${a.id as AccentId}`);
          return (
            <button key={a.id} type="button" title={label} aria-label={label} aria-pressed={selected}
              className="flex h-[67px] items-center justify-center rounded-[4px] text-white hover:opacity-90"
              style={{ backgroundColor: a.hex }} onClick={() => pick(a)}>
              {selected && <Check className="size-5" strokeWidth={3} />}
            </button>
          );
        })}
      </div>
    </AccountMenuSubPanel>
  );
}
