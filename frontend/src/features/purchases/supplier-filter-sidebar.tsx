"use client";

import { useState } from "react";
import { ChevronRight, Pencil } from "lucide-react";
import { formatMoney, parseNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SupplierGroupDialog } from "./supplier-group-dialog";
import { useSupplierGroups } from "./supplier-queries";
import type { SupplierFilters, SupplierGroup } from "./supplier-types";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { purchasesNs } from "@/messages/purchases";

const box = "h-[30px] w-full rounded-md border border-[#d9dbe0] bg-white px-2.5 text-[12px] outline-none focus:border-primary";

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[13px] font-bold">{title}{action}</div>
      {children}
    </div>
  );
}

/** Ô "Từ / Tới [Nhập giá trị]": lưu khi rời ô hoặc Enter để không gọi API theo từng phím. */
function Bound({ label, value, onCommit }: { label: string; value: string; onCommit: (v: string) => void }) {
  const t = useT(purchasesNs);
  const [text, setText] = useState<string | null>(null);
  const commit = () => { if (text !== null) { onCommit(text.trim() ? String(parseNumber(text)) : ""); setText(null); } };
  return (
    <div className="flex h-[30px] overflow-hidden rounded-md border border-[#d9dbe0] bg-white text-[12px] focus-within:border-primary">
      <span className="flex w-10 shrink-0 items-center justify-center bg-[#eff0f3]">{label}</span>
      <input aria-label={label} placeholder={t("suppliers.filter.enterValue")} inputMode="numeric" className="min-w-0 flex-1 px-2 outline-none"
        value={text ?? (value ? formatMoney(value) : "")} onChange={(e) => setText(e.target.value.replace(/[^\d,]/g, ""))}
        onBlur={commit} onKeyDown={(e) => e.key === "Enter" && commit()} />
    </div>
  );
}

/** Sidebar trái màn Nhà cung cấp: Nhóm NCC (+ Tạo mới), Tổng mua (giá trị + thời gian), Nợ hiện tại, Trạng thái. */
export function SupplierFilterSidebar({ value, onChange }: { value: SupplierFilters; onChange: (v: SupplierFilters) => void }) {
  const { data: groups = [] } = useSupplierGroups();
  const [groupDialog, setGroupDialog] = useState<{ group?: SupplierGroup } | null>(null);
  const t = useT(purchasesNs);
  const tc = useT(commonNs);
  const set = (p: Partial<SupplierFilters>) => onChange({ ...value, ...p });
  const current = groups.find((g) => g.id === value.groupId);
  return (
    <aside className="space-y-5 rounded-lg bg-white p-3 text-[12px]">
      <Section title={t("suppliers.cols.group")} action={
        <button type="button" className="text-[12px] font-normal text-primary hover:underline" onClick={() => setGroupDialog({})}>{t("suppliers.filter.createNew")}</button>}>
        <div className="flex gap-1">
          <select className={box} aria-label={t("suppliers.cols.group")} value={value.groupId} onChange={(e) => set({ groupId: e.target.value })}>
            <option value="">{t("suppliers.filter.allGroups")}</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          {current && <button type="button" aria-label={t("suppliers.filter.editGroup")} title={t("suppliers.filter.editGroup")} onClick={() => setGroupDialog({ group: current })}
            className="flex size-[30px] shrink-0 items-center justify-center rounded-md border border-[#d9dbe0] hover:text-primary"><Pencil className="size-3.5" /></button>}
        </div>
      </Section>
      <Section title={t("suppliers.cols.totalBuy")}>
        <div className="text-[12px] text-foreground/70">{t("suppliers.filter.value")}</div>
        <Bound label={t("suppliers.filter.from")} value={value.buyFrom} onCommit={(v) => set({ buyFrom: v })} />
        <Bound label={t("suppliers.filter.to")} value={value.buyTo} onCommit={(v) => set({ buyTo: v })} />
        <div className="pt-1 text-[12px] text-foreground/70">{t("filter.time")}</div>
        {(["all", "custom"] as const).map((m) => (
          <label key={m} className="flex cursor-pointer items-center gap-2">
            <input type="radio" name="buy-period" className="size-3.5 accent-primary" checked={value.buyPeriod === m} onChange={() => set({ buyPeriod: m })} />
            {m === "all" ? (
              <span className={cn(box, "flex items-center justify-between")}>
                {t("suppliers.filter.allTime")} <ChevronRight className="size-3.5 text-muted-foreground" />
              </span>
            ) : (
              <DateRangePicker className={cn(box, "flex items-center justify-between")} value={value.buyPeriod === "custom" ? value : null}
                onChange={(r) => set({ ...r, buyPeriod: "custom" })} />
            )}
          </label>
        ))}
      </Section>
      <Section title={t("suppliers.filter.currentDebt")}>
        <Bound label={t("suppliers.filter.from")} value={value.debtFrom} onCommit={(v) => set({ debtFrom: v })} />
        <Bound label={t("suppliers.filter.to")} value={value.debtTo} onCommit={(v) => set({ debtTo: v })} />
      </Section>
      <Section title={tc("fields.status")}>
        <div className="flex flex-wrap gap-1.5" role="radiogroup">
          {([["", "status.all"], ["active", "status.active"], ["inactive", "status.inactive"]] as const).map(([v, label]) => (
            <button key={v} type="button" role="radio" aria-checked={value.status === v} onClick={() => set({ status: v })}
              className={cn("h-[28px] rounded-full border px-3 text-[12px] transition-colors",
                value.status === v ? "border-primary bg-primary font-semibold text-white" : "border-[#d9dbe0] bg-white hover:border-primary hover:text-primary")}>
              {tc(label)}
            </button>
          ))}
        </div>
      </Section>
      {groupDialog && <SupplierGroupDialog group={groupDialog.group} onClose={() => setGroupDialog(null)}
        onSaved={(g) => { if (!g) set({ groupId: "" }); }} />}
    </aside>
  );
}
