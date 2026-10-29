"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CircleHelp, FileOutput, ListChecks, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PickerPopover } from "@/components/ui/picker-popover";
import { TOOLBAR_BTN } from "@/features/sales/invoice-list-kit";
import { useT } from "@/lib/i18n";
import { deliveryNs } from "@/messages/delivery";

const ICON_BTN = "inline-flex size-[30px] items-center justify-center rounded-md border bg-background text-foreground hover:border-primary hover:text-primary data-popup-open:border-primary data-popup-open:text-primary";

/** Không có trang thiết lập giao hàng riêng → bánh răng mở Thiết lập → Đơn hàng (nơi gần nhất với thiết lập giao hàng). */
export const DELIVERY_SETTINGS_HREF = "/settings/orders";

/** Chọn cột hiển thị: popover checkbox 2 cột (như KiotViet). */
export function ColumnChooser<K extends string>({ columns, shown, onToggle }: {
  columns: readonly (readonly [K, string])[]; shown: (k: K) => boolean; onToggle: (k: K, on: boolean) => void;
}) {
  const t = useT(deliveryNs);
  const [open, setOpen] = useState(false);
  const rows = Math.ceil(columns.length / 2);
  return (
    <PickerPopover open={open} onOpenChange={setOpen} label={t("kv.common.columns")} align="end" triggerClassName={ICON_BTN}
      icon={<ListChecks className="size-4" />} className="w-[360px] p-3">
      <div className="grid grid-flow-col gap-x-4 gap-y-1" style={{ gridTemplateRows: `repeat(${rows}, minmax(0, auto))` }}>
        {columns.map(([k, label], i) => (
          <label key={k} className="flex h-[26px] cursor-pointer items-center gap-2 text-[13px]">
            <input type="checkbox" className="size-4 shrink-0 rounded accent-primary" checked={shown(k)} data-picker-focus={i === 0 ? "" : undefined}
              onChange={(e) => onToggle(k, e.target.checked)} /> {label}
          </label>))}
      </div>
    </PickerPopover>
  );
}

/** Nhóm nút phải đầu trang: Xuất file, chọn cột, thiết lập giao hàng, hướng dẫn (mở tab mới). */
export function DeliveryToolbarRight<K extends string>({ onExport, exportDisabled, exporting, columns, shown, onToggle, helpUrl }: {
  onExport: () => void; exportDisabled: boolean; exporting?: boolean;
  columns: readonly (readonly [K, string])[]; shown: (k: K) => boolean; onToggle: (k: K, on: boolean) => void; helpUrl: string;
}) {
  const t = useT(deliveryNs);
  return (
    <div className="ml-auto flex items-center gap-2">
      <Button variant="outline" className={TOOLBAR_BTN} disabled={exportDisabled || exporting} onClick={onExport}>
        <FileOutput className="size-4" /> {exporting ? t("kv.common.exporting") : t("kv.common.export")}</Button>
      <ColumnChooser columns={columns} shown={shown} onToggle={onToggle} />
      <Link href={DELIVERY_SETTINGS_HREF} className={ICON_BTN} aria-label={t("kv.common.settings")} title={t("kv.common.settings")}>
        <Settings className="size-4" /></Link>
      <a href={helpUrl} target="_blank" rel="noopener noreferrer" className={ICON_BTN} aria-label={t("kv.common.help")} title={t("kv.common.help")}>
        <CircleHelp className="size-4" /></a>
    </div>
  );
}

/** Cột hiển thị lưu theo máy (localStorage); lỗi đọc / ghi → dùng mặc định. */
export function useShownColumns<K extends string>(key: string, defaults: readonly K[]) {
  const [cols, setCols] = useState<K[]>(() => [...defaults]);
  useEffect(() => { // đọc sau khi hiển thị (trùng khớp bản dựng phía server)
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) setCols(JSON.parse(raw) as K[]);
    } catch { /* dùng mặc định */ }
  }, [key]);
  const toggle = (k: K, on: boolean) => setCols((prev) => {
    const next = on ? [...prev.filter((x) => x !== k), k] : prev.filter((x) => x !== k);
    try { window.localStorage.setItem(key, JSON.stringify(next)); } catch { /* bỏ qua */ }
    return next;
  });
  return { shown: (k: K) => cols.includes(k), toggle };
}
