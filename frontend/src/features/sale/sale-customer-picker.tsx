"use client";

import { useEffect, useState } from "react";
import { Plus, Search, TriangleAlert, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { useT } from "@/lib/i18n";
import { formatMoney } from "@/lib/format";
import { saleNs } from "@/messages/sale";
import { CustomerFormDialog } from "@/features/sales/customer-form-dialog";
import { toGroupDiscount } from "@/features/sales/customer-group-discount";
import { useCustomerGroups } from "@/features/sales/sales-queries";
import { useShopSettings } from "@/features/settings/settings-queries";
import type { CustomerList } from "@/features/sales/sales-types";
import { KEYS, load, save } from "./sale-storage";
import { normalize } from "./use-sale-catalog";
import type { SaleCustomer } from "./sale-types";

type Props = { value: SaleCustomer | null; onChange: (c: SaleCustomer | null) => void; branchId: string; inputId?: string };

/** Tìm khách (F4). Có mạng: tìm trên server; mất mạng: tìm trong khách đã lưu trên máy. */
export function SaleCustomerPicker({ value, onChange, branchId, inputId = "sale-customer" }: Props) {
  const tr = useT(saleNs);
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SaleCustomer[]>([]);
  const [creating, setCreating] = useState(false);
  const { data: shop } = useShopSettings();
  const { data: groups = [] } = useCustomerGroups();

  useEffect(() => {
    const q = text.trim();
    if (!q) { setResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const d = await api<CustomerList>(`/customers?q=${encodeURIComponent(q)}&size=10`);
        const found = d.items.map((c) => ({ id: c.id, code: c.code, name: c.name, phone: c.phone, debt: Number(c.debt), groupId: c.groupId,
          groupDiscount: toGroupDiscount(c.groupDiscountType, c.groupDiscountValue) }));
        setResults(found);
        remember(found);
      } catch {
        const nq = normalize(q);
        setResults(load<SaleCustomer[]>(KEYS.customers, []).filter((c) =>
          normalize(c.name).includes(nq) || c.code.toLowerCase().includes(nq) || (c.phone ?? "").includes(q)).slice(0, 10));
      }
    }, 250);
    return () => clearTimeout(t);
  }, [text]);

  // Thiết lập → Khách hàng → Cảnh báo công nợ
  const debtLimit = shop?.customer.debtLimit ?? null;
  const overLimit = value != null && debtLimit != null && (value.debt ?? 0) > debtLimit;
  if (value) {
    return (
      <div className="flex min-h-[30px] flex-wrap items-center gap-x-2 gap-y-1 rounded-md bg-[#eef0f3] px-2.5 py-1 text-[13px]">
        <UserRound className="size-3.5 fill-[#6b7280] text-[#6b7280]" />
        <span className="font-bold text-primary">{value.name} {value.phone}</span>
        {value.debt ? <span className="text-xs text-destructive">{tr("customer.debt", { amount: formatMoney(value.debt) })}</span> : null}
        {overLimit && <span className="flex items-center gap-1 rounded bg-destructive/10 px-1.5 text-xs font-semibold text-destructive">
          <TriangleAlert className="size-3" /> {tr("customer.overLimit", { amount: formatMoney(debtLimit!) })}</span>}
        <button className="ml-auto text-[#6b7280] hover:text-foreground" aria-label={tr("customer.clear")} onClick={() => onChange(null)}><X className="size-4" /></button>
      </div>
    );
  }
  return (
    <div className="relative">
      <div className="flex h-[30px] items-center gap-2 border-b border-[#c8ccd2] focus-within:border-primary">
        <Search className="size-4 text-[#6b7280]" />
        <input id={inputId} data-customer-search="" aria-label={tr("customer.search")} className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[#6b7280]" placeholder={tr("customer.search")} value={text}
          onChange={(e) => { setText(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} />
        <button aria-label={tr("customer.add")} title={tr("customer.add")} className="text-[#4b5563] hover:text-primary" onClick={() => (navigator.onLine ? setCreating(true) : toast.error(tr("customer.addOffline")))}>
          <Plus className="size-4" /></button>
      </div>
      {open && text && (
        <div className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-md border bg-popover shadow-lg">
          {!results.length && <div className="p-3 text-sm text-muted-foreground">{tr("customer.noResults")}</div>}
          {results.map((c) => (
            <button key={c.id} type="button" onMouseDown={(e) => e.preventDefault()} className="block w-full px-3 py-2 text-left text-[13px] hover:bg-muted"
              onClick={() => { onChange(c); setText(""); setOpen(false); }}>
              <span className="font-medium">{c.name}</span>
              <span className="block text-xs text-muted-foreground">{c.code} · {c.phone}</span>
            </button>
          ))}
        </div>
      )}
      {creating && (
        <CustomerFormDialog branchId={branchId} onClose={() => setCreating(false)}
          onSaved={(c) => {
            const g = groups.find((x) => x.id === c.groupId);
            const pc = { id: c.id, code: c.code, name: c.name, phone: c.phone, debt: 0, groupId: c.groupId, groupDiscount: toGroupDiscount(g?.discountType, g?.discountValue) };
            remember([pc]); onChange(pc);
          }} />
      )}
    </div>
  );
}

/** Lưu khách đã tìm thấy để tìm lại được khi mất mạng (giữ 500 khách gần nhất). */
function remember(found: SaleCustomer[]) {
  const all = load<SaleCustomer[]>(KEYS.customers, []);
  const ids = new Set(found.map((c) => c.id));
  save(KEYS.customers, [...found, ...all.filter((c) => !ids.has(c.id))].slice(0, 500));
}
