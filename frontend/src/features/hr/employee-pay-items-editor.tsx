"use client";

import { Plus, X } from "lucide-react";
import type { PayItem } from "./hr-types";
import { MoneyInput, hrInput } from "./hr-form-ui";

/** Danh sách phụ cấp / giảm trừ của nhân viên: tên (gợi ý từ danh mục), cách tính, số tiền. */
export function PayItemsEditor({ title, items, kinds, suggestions, onChange }: {
  title: string; items: PayItem[]; kinds: [PayItem["kind"], string][]; suggestions: string[]; onChange: (v: PayItem[]) => void;
}) {
  const listId = `pay-items-${title}`;
  const set = (i: number, patch: Partial<PayItem>) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold">{title}</p>
        <button type="button" className="flex items-center gap-1 text-[12px] text-primary hover:underline"
          onClick={() => onChange([...items, { name: suggestions[0] ?? "", kind: kinds[0][0], amount: 0 }])}>
          <Plus className="size-3.5" /> Thêm {title.toLowerCase()}
        </button>
      </div>
      {!items.length && <p className="text-[12px] text-muted-foreground">Chưa có {title.toLowerCase()}</p>}
      <datalist id={listId}>{suggestions.map((s) => <option key={s} value={s} />)}</datalist>
      {items.map((it, i) => (
        <div key={i} className="grid grid-cols-[minmax(0,1fr)_150px_130px_24px] items-center gap-2">
          <input list={listId} aria-label={`Tên ${title.toLowerCase()}`} className={hrInput} value={it.name} maxLength={100}
            placeholder={`Tên ${title.toLowerCase()}`} onChange={(e) => set(i, { name: e.target.value })} />
          <select aria-label="Cách tính" className={hrInput} value={it.kind} onChange={(e) => set(i, { kind: e.target.value as PayItem["kind"] })}>
            {kinds.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <MoneyInput aria-label="Số tiền" value={it.amount} onChange={(v) => set(i, { amount: v })} />
          <button type="button" aria-label="Xóa" className="text-muted-foreground hover:text-destructive"
            onClick={() => onChange(items.filter((_, j) => j !== i))}><X className="size-4" /></button>
        </div>
      ))}
    </div>
  );
}
