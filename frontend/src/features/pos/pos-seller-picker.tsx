"use client";

import { useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { useUserLookup } from "@/features/purchases/purchase-queries";
import { normalize } from "./use-pos-catalog";

/** Chọn người bán: nút tên + ▾ → ô "Tìm người bán" + danh sách, người đang chọn có dấu ✓. */
export function PosSellerPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { data: users = [] } = useUserLookup();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const current = users.find((u) => u.id === value);
  const shown = q ? users.filter((u) => normalize(u.fullName).includes(normalize(q))) : users;
  const close = () => { setOpen(false); setQ(""); };

  return (
    <div className="relative min-w-0">
      <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}
        className="flex max-w-[180px] items-center gap-1.5 text-[13px] font-medium">
        <span className="truncate">{current?.fullName ?? "Người bán"}</span>
        <ChevronDown className="size-4 shrink-0 text-[#4b5563]" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" aria-hidden onClick={close} />
          <div className="absolute top-full left-0 z-50 mt-1.5 w-56 rounded-md bg-popover p-2 text-[13px] shadow-lg ring-1 ring-foreground/10"
            onKeyDown={(e) => e.key === "Escape" && close()}>
            <div className="relative mb-1">
              <input autoFocus aria-label="Tìm người bán" placeholder="Tìm người bán" value={q} onChange={(e) => setQ(e.target.value)}
                className="h-8 w-full rounded-md border border-primary pr-8 pl-2.5 outline-none" />
              <Search className="absolute top-2 right-2.5 size-4 text-[#6b7280]" />
            </div>
            <div role="listbox" aria-label="Người bán" className="max-h-64 overflow-y-auto">
              {!shown.length && <div className="px-2.5 py-2 text-muted-foreground">Không tìm thấy</div>}
              {shown.map((u) => (
                <button key={u.id} type="button" role="option" aria-selected={u.id === value}
                  className={`flex w-full items-center justify-between rounded px-2.5 py-2.5 text-left ${u.id === value ? "bg-[#e6f1fe]" : "hover:bg-muted"}`}
                  onClick={() => { onChange(u.id); close(); }}>
                  <span className="truncate">{u.fullName}</span>
                  {u.id === value && <Check className="size-4 shrink-0 text-primary" />}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
