"use client";

import { useEffect, useState } from "react";
import { Plus, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { formatMoney } from "@/lib/format";
import { CustomerFormDialog } from "@/features/sales/customer-form-dialog";
import type { CustomerList } from "@/features/sales/sales-types";
import { KEYS, load, save } from "./pos-storage";
import { normalize } from "./use-pos-catalog";
import type { PosCustomer } from "./pos-types";

type Props = { value: PosCustomer | null; onChange: (c: PosCustomer | null) => void; branchId: string };

/** Tìm khách (F4). Có mạng: tìm trên server; mất mạng: tìm trong khách đã lưu trên máy. */
export function PosCustomerPicker({ value, onChange, branchId }: Props) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<PosCustomer[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const q = text.trim();
    if (!q) { setResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const d = await api<CustomerList>(`/customers?q=${encodeURIComponent(q)}&size=10`);
        const found = d.items.map((c) => ({ id: c.id, code: c.code, name: c.name, phone: c.phone, debt: Number(c.debt) }));
        setResults(found);
        remember(found);
      } catch {
        const nq = normalize(q);
        setResults(load<PosCustomer[]>(KEYS.customers, []).filter((c) =>
          normalize(c.name).includes(nq) || c.code.toLowerCase().includes(nq) || (c.phone ?? "").includes(q)).slice(0, 10));
      }
    }, 250);
    return () => clearTimeout(t);
  }, [text]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "F4") { e.preventDefault(); document.getElementById("pos-customer")?.focus(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm">
        <UserRound className="size-4 text-muted-foreground" />
        <span className="font-semibold text-primary">{value.name} {value.phone}</span>
        {value.debt ? <span className="text-xs text-destructive">Nợ {formatMoney(value.debt)}</span> : null}
        <button className="ml-auto text-muted-foreground" aria-label="Bỏ chọn khách" onClick={() => onChange(null)}><X className="size-4" /></button>
      </div>
    );
  }
  return (
    <div className="relative">
      <div className="flex items-center gap-2 border-b py-1">
        <UserRound className="size-4 text-muted-foreground" />
        <input id="pos-customer" className="flex-1 bg-transparent text-sm outline-none" placeholder="Tìm khách hàng (F4)" value={text}
          onChange={(e) => { setText(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} />
        <button aria-label="Thêm khách hàng" onClick={() => (navigator.onLine ? setCreating(true) : toast.error("Mất mạng: chưa thêm được khách mới, bán cho khách lẻ hoặc khách đã có"))}>
          <Plus className="size-4" /></button>
      </div>
      {open && text && (
        <div className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-md border bg-popover shadow-lg">
          {!results.length && <div className="p-3 text-sm text-muted-foreground">Không tìm thấy khách hàng</div>}
          {results.map((c) => (
            <button key={c.id} type="button" onMouseDown={(e) => e.preventDefault()} className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
              onClick={() => { onChange(c); setText(""); setOpen(false); }}>
              <span className="font-medium">{c.name}</span>
              <span className="block text-xs text-muted-foreground">{c.code} · {c.phone}</span>
            </button>
          ))}
        </div>
      )}
      {creating && (
        <CustomerFormDialog branchId={branchId} onClose={() => setCreating(false)}
          onSaved={(c) => { const pc = { id: c.id, code: c.code, name: c.name, phone: c.phone, debt: 0 }; remember([pc]); onChange(pc); }} />
      )}
    </div>
  );
}

/** Lưu khách đã tìm thấy để tìm lại được khi mất mạng (giữ 500 khách gần nhất). */
function remember(found: PosCustomer[]) {
  const all = load<PosCustomer[]>(KEYS.customers, []);
  const ids = new Set(found.map((c) => c.id));
  save(KEYS.customers, [...found, ...all.filter((c) => !ids.has(c.id))].slice(0, 500));
}
