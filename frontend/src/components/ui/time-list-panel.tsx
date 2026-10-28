"use client";

import * as React from "react";
import { cn } from "cn";
import { pad2 } from "@/lib/date-input-format";

const HOURS = Array.from({ length: 24 }, (_, i) => pad2(i));
const MINUTES = Array.from({ length: 60 }, (_, i) => pad2(i));

/** Một cột giờ hoặc phút: cuộn tới mục đang chọn, phím ↑/↓ để di chuyển, Enter để chọn. */
function TimeColumn({ label, items, value, onPick, autoFocus }: {
  label: string; items: string[]; value: string; onPick: (v: string) => void; autoFocus?: boolean;
}) {
  const list = React.useRef<HTMLDivElement>(null);
  const active = items.includes(value) ? value : items[0];

  React.useLayoutEffect(() => {
    const el = list.current?.querySelector<HTMLElement>(`[data-v="${active}"]`);
    if (el && list.current) list.current.scrollTop = el.offsetTop - list.current.clientHeight / 2 + el.clientHeight / 2;
  }, [active]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const delta = { ArrowDown: 1, ArrowUp: -1, PageDown: 6, PageUp: -6 }[e.key];
    if (!delta) return;
    e.preventDefault();
    const btns = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("button"));
    const i = btns.indexOf(document.activeElement as HTMLElement);
    btns[Math.min(btns.length - 1, Math.max(0, (i < 0 ? 0 : i) + delta))]?.focus();
  };

  return (
    <div className="flex flex-col">
      <span className="pb-1 text-center text-[12px] font-medium text-muted-foreground">{label}</span>
      <div ref={list} role="listbox" aria-label={label} onKeyDown={onKeyDown} className="relative h-[220px] w-14 overflow-y-auto pr-0.5">
        {items.map((v) => (
          <button key={v} type="button" role="option" data-v={v} aria-selected={v === value}
            tabIndex={v === active ? 0 : -1} data-picker-focus={(autoFocus && v === active) || undefined}
            onClick={() => onPick(v)}
            className={cn("block h-7 w-full rounded text-center text-[13px] outline-none hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-primary/60",
              v === value && "bg-primary text-white hover:bg-primary")}>
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Bảng chọn giờ:phút 24h. Chọn giờ giữ nguyên phút; chọn phút thì xong (`done = true`).
 * `value` "HH:mm" hoặc rỗng.
 */
export function TimeListPanel({ value, onPick }: { value: string; onPick: (hm: string, done: boolean) => void }) {
  const [h, m] = /^\d{2}:\d{2}$/.test(value) ? value.split(":") : ["", ""];
  return (
    <div className="flex gap-2">
      <TimeColumn label="Giờ" items={HOURS} value={h} autoFocus onPick={(v) => onPick(`${v}:${m || "00"}`, false)} />
      <TimeColumn label="Phút" items={MINUTES} value={m} onPick={(v) => onPick(`${h || pad2(new Date().getHours())}:${v}`, true)} />
    </div>
  );
}
