"use client";

import { useEffect, useState } from "react";
import { ListChecks } from "lucide-react";
import { PickerPopover } from "@/components/ui/picker-popover";
import { useT } from "@/lib/i18n";
import { purchasesNs } from "@/messages/purchases";

/** Cột thêm của danh sách Trả hàng nhập (ẩn mặc định, bật ở nút chọn cột; lưu localStorage). */
export type ReturnExtraColumn = "receiptCode" | "createdBy" | "branch" | "note";
export const RETURN_EXTRA_COLUMNS: ReturnExtraColumn[] = ["receiptCode", "createdBy", "branch", "note"];
const KEY = "purchase-return-columns";

export function useReturnColumns(): [ReturnExtraColumn[], (c: ReturnExtraColumn, on: boolean) => void] {
  const [shown, setShown] = useState<ReturnExtraColumn[]>([]);
  useEffect(() => {
    try { setShown(JSON.parse(localStorage.getItem(KEY) ?? "[]")); } catch { /* mặc định: không cột thêm */ }
  }, []);
  const toggle = (c: ReturnExtraColumn, on: boolean) => {
    const next = on ? [...shown.filter((x) => x !== c), c] : shown.filter((x) => x !== c);
    setShown(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* chỉ giữ trong phiên */ }
  };
  return [shown, toggle];
}

const ICON_BTN = "inline-flex size-[30px] items-center justify-center rounded-md border bg-background text-foreground hover:border-primary hover:text-primary data-popup-open:border-primary data-popup-open:text-primary";

export function ReturnColumnPicker({ shown, onToggle }: { shown: ReturnExtraColumn[]; onToggle: (c: ReturnExtraColumn, on: boolean) => void }) {
  const t = useT(purchasesNs);
  const [open, setOpen] = useState(false);
  return (
    <PickerPopover open={open} onOpenChange={setOpen} label={t("kv.columns")} align="end" triggerClassName={ICON_BTN}
      icon={<ListChecks className="size-4" />} className="w-[240px] p-3">
      {RETURN_EXTRA_COLUMNS.map((c, i) => (
        <label key={c} className="flex h-[26px] cursor-pointer items-center gap-2 text-[13px]">
          <input type="checkbox" className="size-4 accent-primary" checked={shown.includes(c)} data-picker-focus={i === 0 ? "" : undefined}
            onChange={(e) => onToggle(c, e.target.checked)} /> {t(`kv.returnCol.${c}`)}
        </label>
      ))}
    </PickerPopover>
  );
}
