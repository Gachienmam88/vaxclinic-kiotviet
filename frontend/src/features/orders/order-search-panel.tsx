"use client";

import { useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PickerPopover } from "@/components/ui/picker-popover";
import { useT } from "@/lib/i18n";
import { ordersNs } from "@/messages/orders";

export type OrderSearch = { q: string; productQ: string; customerQ: string };
export const EMPTY_ORDER_SEARCH: OrderSearch = { q: "", productQ: "", customerQ: "" };
const LINE = "h-9 w-full border-0 border-b border-[#c8ccd2] bg-transparent text-[13px] outline-none focus:border-primary";

/**
 * Ô tìm "Theo mã phiếu đặt" + nút ⚙ mở khung tìm nâng cao (KiotViet): mã phiếu đặt / mã, tên hàng / mã, tên, SĐT khách;
 * "Xóa điều kiện" và "Tìm kiếm". Ô chính tìm ngay khi gõ (theo mã phiếu đặt).
 */
export function OrderSearchPanel({ value, onChange }: { value: OrderSearch; onChange: (s: OrderSearch) => void }) {
  const t = useT(ordersNs);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const field = (k: keyof OrderSearch, ph: string, first = false) => (
    <input className={LINE} placeholder={ph} aria-label={ph} value={draft[k]} data-picker-focus={first ? "" : undefined}
      onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") { onChange(draft); setOpen(false); } }} />);
  return (
    <div className="relative flex h-[30px] w-[370px] items-center rounded-md border bg-background pr-1 pl-2.5 focus-within:border-primary">
      <Search className="size-4 text-muted-foreground" />
      <input className="h-full min-w-0 flex-1 bg-transparent px-2 text-[13px] outline-none" placeholder={t("kv.search")} aria-label={t("kv.search")}
        value={value.q} onChange={(e) => onChange({ ...value, q: e.target.value })} />
      <PickerPopover open={open} onOpenChange={(o) => { setOpen(o); if (o) setDraft(value); }} label={t("kv.doSearch")} align="end"
        triggerClassName="grid size-6 place-items-center rounded text-muted-foreground hover:text-primary" icon={<SlidersHorizontal className="size-4" />}
        className="w-[370px] space-y-2 p-4">
        {field("q", t("kv.search"), true)}{field("productQ", t("kv.searchProduct"))}{field("customerQ", t("kv.searchCustomer"))}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" className="h-8" onClick={() => { setDraft(EMPTY_ORDER_SEARCH); onChange(EMPTY_ORDER_SEARCH); }}>{t("kv.clear")}</Button>
          <Button className="h-8" onClick={() => { onChange(draft); setOpen(false); }}>{t("kv.doSearch")}</Button>
        </div>
      </PickerPopover>
    </div>
  );
}
