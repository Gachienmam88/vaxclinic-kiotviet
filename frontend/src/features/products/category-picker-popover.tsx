"use client";

import { useMemo, useRef, useState } from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { zoomAwarePositioning } from "@/lib/zoom-aware-floating-anchor";
import { flattenCategoryTree, useCategories } from "./product-queries";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { productsNs } from "@/messages/products";

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase();

/**
 * Ô "Chọn nhóm hàng" kiểu KiotViet: bấm mở bảng bên phải gồm ô tìm kiếm, danh sách checkbox "Tên (số hàng)",
 * chân "Chọn tất cả" + "Áp dụng". Chỉ ghi giá trị khi bấm Áp dụng.
 */
export function CategoryPickerPopover({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const { data: categories = [] } = useCategories();
  const options = useMemo(() => flattenCategoryTree(categories), [categories]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(value);
  const [query, setQuery] = useState("");
  const anchor = useRef<HTMLButtonElement>(null);
  const t = useT(productsNs);
  const tc = useT(commonNs);
  const selectedNames = options.filter((o) => value.includes(o.id)).map((o) => o.name);
  const shown = query.trim() ? options.filter((o) => fold(o.name).includes(fold(query.trim()))) : options;
  const positioning = useMemo(() => (open ? zoomAwarePositioning(() => anchor.current) : undefined), [open]);

  function toggleOpen(o: boolean) {
    if (o) { setDraft(value); setQuery(""); }
    setOpen(o);
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={toggleOpen}>
      <PopoverPrimitive.Trigger ref={anchor} type="button"
        className="flex h-8 w-full items-center rounded-md border border-input bg-background px-2.5 text-left text-[13px] outline-none focus-visible:border-primary">
        <span className={cn("min-w-0 flex-1 truncate", !selectedNames.length && "text-muted-foreground")} title={selectedNames.join(", ")}>
          {selectedNames.length ? selectedNames.join(", ") : t("filter.pickCategory")}
        </span>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner className="isolate z-50 outline-none" {...positioning} side="right" align="start" sideOffset={8}
          alignOffset={-90}>
          <PopoverPrimitive.Popup aria-label={t("fields.category")}
            className="flex h-[450px] w-[290px] flex-col rounded-lg border bg-popover text-[13px] text-popover-foreground shadow-lg outline-none">
            <div className="px-3 pt-3 pb-2 font-bold">{t("fields.category")}</div>
            <div className="relative mx-3 mb-2">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <input autoFocus aria-label={tc("actions.search")} placeholder={tc("actions.search")} value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-8 w-full rounded-md border border-primary bg-background pr-2 pl-8 outline-none placeholder:text-muted-foreground" />
            </div>
            <ul className="min-h-0 flex-1 overflow-y-auto px-3">
              {!shown.length && <li className="py-2 text-muted-foreground">{t("categoryPicker.empty")}</li>}
              {shown.map((o) => (
                <li key={o.id}>
                  <label className="flex cursor-pointer items-center gap-2 py-1.5" style={{ paddingLeft: o.depth * 16 }}>
                    <Checkbox checked={draft.includes(o.id)}
                      onCheckedChange={(on) => setDraft((d) => (on ? [...d, o.id] : d.filter((x) => x !== o.id)))} />
                    <span>{o.name} ({o.productCount ?? 0})</span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between border-t px-3 py-3">
              <button type="button" className="text-primary hover:underline"
                onClick={() => setDraft((d) => [...new Set([...d, ...shown.map((o) => o.id)])])}>
                {t("categoryPicker.selectAll")}
              </button>
              <Button className="h-8 rounded-md px-3 font-semibold" onClick={() => { onChange(draft); setOpen(false); }}>
                {tc("actions.apply")}
              </Button>
            </div>
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
