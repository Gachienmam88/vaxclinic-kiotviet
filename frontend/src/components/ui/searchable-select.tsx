"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { searchUnits, type VnUnit } from "@/lib/vn-admin-search";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";

type Props = {
  options: VnUnit[];
  value: string;
  /** Tên hiển thị khi value không có trong options (dữ liệu cũ chỉ có tên, hoặc danh mục chưa tải xong). */
  fallbackLabel?: string;
  onChange: (unit: VnUnit | null) => void;
  placeholder: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
};

/** Ô chọn có tìm kiếm không dấu (danh sách hiển thị tối đa 100 dòng khớp). Phím ↑ ↓ Enter Esc. */
export function SearchableSelect({ options, value, fallbackLabel, onChange, placeholder, searchPlaceholder: searchPlaceholderProp,
  disabled, className, id, ...aria }: Props) {
  const tc = useT(commonNs);
  const searchPlaceholder = searchPlaceholderProp ?? tc("select.search");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const items = useMemo(() => searchUnits(options, q), [options, q]);
  const selected = options.find((o) => o.code === value);
  const label = selected?.name ?? fallbackLabel ?? "";

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const pick = (u: VnUnit | null) => { onChange(u); setOpen(false); setQ(""); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, items.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (items[active]) pick(items[active]); }
    else if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
  };

  return (
    <div ref={box} className="relative">
      <button type="button" id={id} disabled={disabled} aria-label={aria["aria-label"]} aria-haspopup="listbox" aria-expanded={open}
        onClick={() => { setOpen((o) => !o); setActive(0); }}
        className={cn("flex h-8 w-full items-center gap-1 rounded-md border border-input bg-background px-2.5 text-left text-sm outline-none focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50", className)}>
        <span className={cn("flex-1 truncate", !label && "text-muted-foreground")}>{label || placeholder}</span>
        {label && !disabled && (
          <span role="button" tabIndex={-1} aria-label={tc("select.clear")} className="rounded p-0.5 text-muted-foreground hover:text-foreground"
            onClick={(e) => { e.stopPropagation(); pick(null); }}><X className="size-3.5" /></span>)}
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[220px] rounded-md border bg-popover shadow-lg">
          <div className="relative border-b p-1.5">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input autoFocus aria-label={searchPlaceholder} placeholder={searchPlaceholder} value={q} onKeyDown={onKey}
              onChange={(e) => { setQ(e.target.value); setActive(0); }}
              className="h-7 w-full rounded border border-input bg-background pr-2 pl-7 text-sm outline-none focus:border-primary" />
          </div>
          <ul role="listbox" className="max-h-64 overflow-y-auto py-1">
            {!items.length && <li className="px-3 py-2 text-sm text-muted-foreground">{tc("select.noResults")}</li>}
            {items.map((u, i) => (
              <li key={u.code} role="option" aria-selected={u.code === value} onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()} onClick={() => pick(u)}
                className={cn("cursor-pointer px-3 py-1.5 text-sm", i === active && "bg-muted", u.code === value && "font-semibold text-primary")}>
                {u.name}
              </li>))}
          </ul>
        </div>)}
    </div>
  );
}
