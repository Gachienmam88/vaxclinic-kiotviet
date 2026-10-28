"use client";

import { X } from "lucide-react";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { saleNs } from "@/messages/sale";
import { SHORTCUT_HELP } from "./sale-shortcuts";

/** Ngăn phải "Phím tắt chức năng" (phủ mờ phần còn lại, bấm ra ngoài / Esc để đóng). */
export function SaleShortcutsDrawer({ onClose }: { onClose: () => void }) {
  const t = useT(saleNs);
  const tc = useT(commonNs);
  return (
    <div className="fixed inset-0 z-50" onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div className="absolute inset-0 bg-black/40" aria-hidden onClick={onClose} />
      <aside role="dialog" aria-label={t("shortcuts.title")}
        className="absolute inset-y-0 right-0 w-[274px] overflow-y-auto rounded-l-xl bg-background px-6 py-5 text-[13px] shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[15px] font-bold">{t("shortcuts.title")}</h2>
          <button type="button" autoFocus aria-label={tc("actions.close")} className="text-[#4b5563] hover:text-foreground" onClick={onClose}><X className="size-5" /></button>
        </div>
        <dl className="grid grid-cols-[72px_1fr] gap-x-2 gap-y-2.5">
          {SHORTCUT_HELP.map(([k, v]) => <div key={k} className="contents"><dt className="font-medium">{k}{k.length > 1 ? ":" : ""}</dt><dd>{t(v)}</dd></div>)}
        </dl>
      </aside>
    </div>
  );
}
