"use client";

import { Plus, X } from "lucide-react";
import type { PayItem } from "./hr-types";
import type { PayKindKey } from "./salary-template-pay-items";
import { MoneyInput, hrInput } from "./hr-form-ui";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { hrNs } from "@/messages/hr";

/** Danh sách phụ cấp / giảm trừ của nhân viên: tên (gợi ý từ danh mục), cách tính (khóa nhãn hr), số tiền. */
export function PayItemsEditor({ title, items, kinds, suggestions, onChange }: {
  title: string; items: PayItem[]; kinds: readonly (readonly [PayItem["kind"], PayKindKey])[]; suggestions: string[]; onChange: (v: PayItem[]) => void;
}) {
  const t = useT(hrNs);
  const tc = useT(commonNs);
  const listId = `pay-items-${title}`;
  const set = (i: number, patch: Partial<PayItem>) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold">{title}</p>
        <button type="button" className="flex items-center gap-1 text-[12px] text-primary hover:underline"
          onClick={() => onChange([...items, { name: suggestions[0] ?? "", kind: kinds[0][0], amount: 0 }])}>
          <Plus className="size-3.5" /> {tc("actions.add")}
        </button>
      </div>
      {!items.length && <p className="text-[12px] text-muted-foreground">{t("payItems.empty")}</p>}
      <datalist id={listId}>{suggestions.map((s) => <option key={s} value={s} />)}</datalist>
      {items.map((it, i) => (
        <div key={i} className="grid grid-cols-[minmax(0,1fr)_150px_130px_24px] items-center gap-2">
          <input list={listId} aria-label={t("payItems.name")} className={hrInput} value={it.name} maxLength={100}
            placeholder={t("payItems.name")} onChange={(e) => set(i, { name: e.target.value })} />
          <select aria-label={t("payItems.method")} className={hrInput} value={it.kind} onChange={(e) => set(i, { kind: e.target.value as PayItem["kind"] })}>
            {kinds.map(([k, l]) => <option key={k} value={k}>{t(l)}</option>)}
          </select>
          <MoneyInput aria-label={t("payItems.amount")} value={it.amount} onChange={(v) => set(i, { amount: v })} />
          <button type="button" aria-label={tc("actions.delete")} className="text-muted-foreground hover:text-destructive"
            onClick={() => onChange(items.filter((_, j) => j !== i))}><X className="size-4" /></button>
        </div>
      ))}
    </div>
  );
}
