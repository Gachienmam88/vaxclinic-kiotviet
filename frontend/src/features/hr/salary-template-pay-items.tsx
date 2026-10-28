"use client";

import { Plus, X } from "lucide-react";
import { formatMoney, parseNumber } from "@/lib/format";
import type { PayItem } from "./hr-types";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { hrNs } from "@/messages/hr";

const box = "h-7 rounded border border-[#d9dbe0] bg-white px-1.5 text-[12px] outline-none focus:border-primary";

/** Khóa nhãn cách tính phụ cấp / giảm trừ (namespace hr). */
export type PayKindKey = "payKind.perWorkday" | "payKind.monthlyFixed" | "payKind.perLate" | "payKind.perEarly";
type PayKinds = readonly (readonly [PayItem["kind"], PayKindKey])[];
export const ALLOWANCE_KINDS = [["DAY", "payKind.perWorkday"], ["MONTH", "payKind.monthlyFixed"]] as const satisfies PayKinds;
export const DEDUCTION_KINDS = [["LATE", "payKind.perLate"], ["EARLY", "payKind.perEarly"], ["MONTH", "payKind.monthlyFixed"]] as const satisfies PayKinds;

/** Sửa danh sách phụ cấp / giảm trừ: tên (gợi ý từ danh mục thiết lập), cách tính, số tiền. */
export function SalaryTemplatePayItems({ title, items, onChange, kinds, suggestions }: {
  title: string; items: PayItem[]; onChange: (items: PayItem[]) => void; kinds: PayKinds; suggestions: string[];
}) {
  const t = useT(hrNs);
  const tc = useT(commonNs);
  const listId = `pay-items-${title}`;
  const set = (i: number, patch: Partial<PayItem>) => onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  return (
    <div className="space-y-1.5 text-[12px]">
      <div className="flex items-center justify-between">
        <span className="font-semibold">{title}</span>
        <button type="button" className="flex items-center gap-1 text-primary hover:underline"
          onClick={() => onChange([...items, { name: suggestions[0] ?? "", kind: kinds[0][0], amount: 0 }])}>
          <Plus className="size-3.5" /> {tc("actions.add")}</button>
      </div>
      <datalist id={listId}>{suggestions.map((s) => <option key={s} value={s} />)}</datalist>
      {!items.length && <p className="text-muted-foreground">{tc("status.none")}</p>}
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <input list={listId} aria-label={t("payItems.rowName", { title, n: i + 1 })} className={`${box} flex-1`} value={it.name}
            onChange={(e) => set(i, { name: e.target.value })} />
          <select aria-label={t("payItems.rowMethod", { title, n: i + 1 })} className={box} value={it.kind}
            onChange={(e) => set(i, { kind: e.target.value as PayItem["kind"] })}>
            {kinds.map(([k, l]) => <option key={k} value={k}>{t(l)}</option>)}
          </select>
          <input aria-label={t("payItems.rowAmount", { title, n: i + 1 })} className={`${box} w-24 text-right`} value={formatMoney(it.amount)}
            onChange={(e) => set(i, { amount: parseNumber(e.target.value.replace(/[^\d,]/g, "")) })} />
          <button type="button" aria-label={t("payItems.rowDelete", { title, n: i + 1 })} onClick={() => onChange(items.filter((_, j) => j !== i))}>
            <X className="size-3.5 hover:text-destructive" /></button>
        </div>
      ))}
    </div>
  );
}
