"use client";

import { Plus, X } from "lucide-react";
import { formatMoney, parseNumber } from "@/lib/format";
import type { PayItem } from "./hr-types";

const box = "h-7 rounded border border-[#d9dbe0] bg-white px-1.5 text-[12px] outline-none focus:border-primary";

export const ALLOWANCE_KINDS: [PayItem["kind"], string][] = [["DAY", "Theo ngày làm việc"], ["MONTH", "Cố định hàng tháng"]];
export const DEDUCTION_KINDS: [PayItem["kind"], string][] = [["LATE", "Mỗi lần đi muộn"], ["EARLY", "Mỗi lần về sớm"], ["MONTH", "Cố định hàng tháng"]];

/** Sửa danh sách phụ cấp / giảm trừ: tên (gợi ý từ danh mục thiết lập), cách tính, số tiền. */
export function SalaryTemplatePayItems({ title, items, onChange, kinds, suggestions }: {
  title: string; items: PayItem[]; onChange: (items: PayItem[]) => void; kinds: [PayItem["kind"], string][]; suggestions: string[];
}) {
  const listId = `pay-items-${title}`;
  const set = (i: number, patch: Partial<PayItem>) => onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  return (
    <div className="space-y-1.5 text-[12px]">
      <div className="flex items-center justify-between">
        <span className="font-semibold">{title}</span>
        <button type="button" className="flex items-center gap-1 text-primary hover:underline"
          onClick={() => onChange([...items, { name: suggestions[0] ?? "", kind: kinds[0][0], amount: 0 }])}>
          <Plus className="size-3.5" /> Thêm</button>
      </div>
      <datalist id={listId}>{suggestions.map((s) => <option key={s} value={s} />)}</datalist>
      {!items.length && <p className="text-muted-foreground">Không có</p>}
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <input list={listId} aria-label={`Tên ${title} ${i + 1}`} className={`${box} flex-1`} value={it.name}
            onChange={(e) => set(i, { name: e.target.value })} />
          <select aria-label={`Cách tính ${title} ${i + 1}`} className={box} value={it.kind}
            onChange={(e) => set(i, { kind: e.target.value as PayItem["kind"] })}>
            {kinds.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <input aria-label={`Số tiền ${title} ${i + 1}`} className={`${box} w-24 text-right`} value={formatMoney(it.amount)}
            onChange={(e) => set(i, { amount: parseNumber(e.target.value.replace(/[^\d,]/g, "")) })} />
          <button type="button" aria-label={`Xóa ${title} ${i + 1}`} onClick={() => onChange(items.filter((_, j) => j !== i))}>
            <X className="size-3.5 hover:text-destructive" /></button>
        </div>
      ))}
    </div>
  );
}
