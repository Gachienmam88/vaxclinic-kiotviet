"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, CircleHelp, FileOutput, Plus, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PickerPopover } from "@/components/ui/picker-popover";
import { ColumnChooser } from "@/features/delivery/delivery-list-toolbar";
import { TOOLBAR_BTN } from "@/features/sales/invoice-list-kit";
import { useT } from "@/lib/i18n";
import { salesNs } from "@/messages/sales";
import { RETURN_COLUMNS, type ReturnColumn } from "./return-list-columns";

const ICON_BTN = "inline-flex size-[30px] items-center justify-center rounded-md border bg-background text-foreground hover:border-primary hover:text-primary";
const HELP = "https://www.kiotviet.vn/huong-dan-su-dung-kiotviet/retail-tra-hang/tra-hang/";

/**
 * Nút phải trang Trả hàng: "+ Trả hàng" (màn bán hàng, mở "Chọn hóa đơn trả hàng"), "Xuất file ▾" (File tổng quan / File chi tiết),
 * chọn cột (Mã trả hàng luôn hiện), thiết lập đơn hàng, hướng dẫn (tab mới).
 */
export function ReturnListToolbar({ canReturn, exportDisabled, onExport, shown, onToggle }: {
  canReturn: boolean; exportDisabled: boolean; onExport: (kind: "overview" | "detail") => void;
  shown: (c: ReturnColumn) => boolean; onToggle: (c: ReturnColumn, on: boolean) => void;
}) {
  const t = useT(salesNs);
  const [open, setOpen] = useState(false);
  const pick = (k: "overview" | "detail") => { setOpen(false); onExport(k); };
  return (
    <div className="ml-auto flex items-center gap-2">
      {canReturn && <Button variant="outline" className={TOOLBAR_BTN} render={<Link href="/sale?returnPicker=1" />}>
        <Plus className="size-4" /> {t("returns.kv.newReturn")}</Button>}
      <PickerPopover open={open} onOpenChange={setOpen} label={t("returns.kv.export")} align="end" disabled={exportDisabled}
        triggerClassName={`${TOOLBAR_BTN} inline-flex items-center gap-1.5 border disabled:opacity-50`} className="w-44 p-1"
        icon={<><FileOutput className="size-4" />{t("returns.kv.export")}<ChevronDown className="size-3.5" /></>}>
        {(["overview", "detail"] as const).map((k, i) => (
          <button key={k} type="button" data-picker-focus={i === 0 ? "" : undefined} onClick={() => pick(k)}
            className="block h-8 w-full rounded px-2.5 text-left text-[13px] hover:bg-muted">
            {t(k === "overview" ? "returns.kv.exportOverview" : "returns.kv.exportDetail")}</button>))}
      </PickerPopover>
      <ColumnChooser columns={RETURN_COLUMNS.map((c) => [c, t(`returns.kv.cols.${c}`)] as const)} shown={shown} onToggle={onToggle} />
      <Link href="/settings/orders" className={ICON_BTN} aria-label={t("returns.kv.settings")} title={t("returns.kv.settings")}><Settings className="size-4" /></Link>
      <a href={HELP} target="_blank" rel="noopener noreferrer" className={ICON_BTN} aria-label={t("returns.kv.help")} title={t("returns.kv.help")}>
        <CircleHelp className="size-4" /></a>
    </div>
  );
}
