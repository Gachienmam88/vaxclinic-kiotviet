"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, CircleHelp, FileOutput, Merge, Plus, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PickerPopover } from "@/components/ui/picker-popover";
import { ColumnChooser } from "@/features/delivery/delivery-list-toolbar";
import { TOOLBAR_BTN } from "@/features/sales/invoice-list-kit";
import { useT } from "@/lib/i18n";
import { ordersNs } from "@/messages/orders";
import { ORDER_COLUMNS, type OrderColumn } from "./order-list-columns";

const ICON_BTN = "inline-flex size-[30px] items-center justify-center rounded-md border bg-background text-foreground hover:border-primary hover:text-primary";
const HELP = "https://www.kiotviet.vn/huong-dan-su-dung-kiotviet/retail-dat-hang/dat-hang/";

/**
 * Nút phải trang Đặt hàng: "+ Đặt hàng" (màn bán hàng, tab đặt hàng mới), "Xuất file ▾" (tổng quan / chi tiết), chọn cột,
 * thiết lập đơn hàng, hướng dẫn (tab mới); "Gộp đơn" mở hộp thoại gộp đơn cùng khách trong 7 ngày.
 */
export function OrderListToolbar({ canOrder, onMerge, exportDisabled, onExport, shown, onToggle }: {
  canOrder: boolean; onMerge: () => void; exportDisabled: boolean; onExport: (kind: "overview" | "detail") => void;
  shown: (c: OrderColumn) => boolean; onToggle: (c: OrderColumn, on: boolean) => void;
}) {
  const t = useT(ordersNs);
  const [open, setOpen] = useState(false);
  return (
    <div className="ml-auto flex items-center gap-2">
      {canOrder && <Button variant="outline" className={TOOLBAR_BTN} render={<Link href="/sale?newOrder=1" />}>
        <Plus className="size-4" /> {t("kv.newOrder")}</Button>}
      {canOrder && <Button variant="outline" className={TOOLBAR_BTN} onClick={onMerge}><Merge className="size-4" /> {t("kv.merge.button")}</Button>}
      <PickerPopover open={open} onOpenChange={setOpen} label={t("kv.export")} align="end" disabled={exportDisabled}
        triggerClassName={`${TOOLBAR_BTN} inline-flex items-center gap-1.5 border disabled:opacity-50`} className="w-44 p-1"
        icon={<><FileOutput className="size-4" />{t("kv.export")}<ChevronDown className="size-3.5" /></>}>
        {(["overview", "detail"] as const).map((k, i) => (
          <button key={k} type="button" data-picker-focus={i === 0 ? "" : undefined} onClick={() => { setOpen(false); onExport(k); }}
            className="block h-8 w-full rounded px-2.5 text-left text-[13px] hover:bg-muted">
            {t(k === "overview" ? "kv.exportOverview" : "kv.exportDetail")}</button>))}
      </PickerPopover>
      <ColumnChooser columns={ORDER_COLUMNS.map((c) => [c, t(`kv.cols.${c}`)] as const)} shown={shown} onToggle={onToggle} />
      <Link href="/settings/orders" className={ICON_BTN} aria-label={t("kv.settings")} title={t("kv.settings")}><Settings className="size-4" /></Link>
      <a href={HELP} target="_blank" rel="noopener noreferrer" className={ICON_BTN} aria-label={t("kv.help")} title={t("kv.help")}>
        <CircleHelp className="size-4" /></a>
    </div>
  );
}
