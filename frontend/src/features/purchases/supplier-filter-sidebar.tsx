"use client";

import { useState } from "react";
import { CalendarDays, ChevronRight, Pencil } from "lucide-react";
import { formatMoney, parseNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SupplierGroupDialog } from "./supplier-group-dialog";
import { useSupplierGroups } from "./supplier-queries";
import type { SupplierFilters, SupplierGroup } from "./supplier-types";

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
  const [text, setText] = useState<string | null>(null);
  const commit = () => { if (text !== null) { onCommit(text.trim() ? String(parseNumber(text)) : ""); setText(null); } };
  return (
    <div className="flex h-[30px] overflow-hidden rounded-md border border-[#d9dbe0] bg-white text-[12px] focus-within:border-primary">
      <span className="flex w-10 shrink-0 items-center justify-center bg-[#eff0f3]">{label}</span>
      <input aria-label={label} placeholder="Nhập giá trị" inputMode="numeric" className="min-w-0 flex-1 px-2 outline-none"
        value={text ?? (value ? formatMoney(value) : "")} onChange={(e) => setText(e.target.value.replace(/[^\d,]/g, ""))}
        onBlur={commit} onKeyDown={(e) => e.key === "Enter" && commit()} />
    </div>
  );
}

/** Sidebar trái màn Nhà cung cấp: Nhóm NCC (+ Tạo mới), Tổng mua (giá trị + thời gian), Nợ hiện tại, Trạng thái. */
export function SupplierFilterSidebar({ value, onChange }: { value: SupplierFilters; onChange: (v: SupplierFilters) => void }) {
  const { data: groups = [] } = useSupplierGroups();
  const [groupDialog, setGroupDialog] = useState<{ group?: SupplierGroup } | null>(null);
  const set = (p: Partial<SupplierFilters>) => onChange({ ...value, ...p });
  const current = groups.find((g) => g.id === value.groupId);
  return (
    <aside className="space-y-5 rounded-lg bg-white p-3 text-[12px]">
      <Section title="Nhóm nhà cung cấp" action={
        <button type="button" className="text-[12px] font-normal text-primary hover:underline" onClick={() => setGroupDialog({})}>Tạo mới</button>}>
        <div className="flex gap-1">
          <select className={box} aria-label="Nhóm nhà cung cấp" value={value.groupId} onChange={(e) => set({ groupId: e.target.value })}>
            <option value="">Tất cả các nhóm</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          {current && <button type="button" aria-label="Sửa nhóm" title="Sửa nhóm" onClick={() => setGroupDialog({ group: current })}
            className="flex size-[30px] shrink-0 items-center justify-center rounded-md border border-[#d9dbe0] hover:text-primary"><Pencil className="size-3.5" /></button>}
        </div>
      </Section>
      <Section title="Tổng mua">
        <div className="text-[12px] text-foreground/70">Giá trị</div>
        <Bound label="Từ" value={value.buyFrom} onCommit={(v) => set({ buyFrom: v })} />
        <Bound label="Tới" value={value.buyTo} onCommit={(v) => set({ buyTo: v })} />
        <div className="pt-1 text-[12px] text-foreground/70">Thời gian</div>
        {(["all", "custom"] as const).map((m) => (
          <label key={m} className="flex cursor-pointer items-center gap-2">
            <input type="radio" name="buy-period" className="size-3.5 accent-primary" checked={value.buyPeriod === m} onChange={() => set({ buyPeriod: m })} />
            <span className={cn(box, "flex items-center justify-between")}>
              {m === "all" ? "Toàn thời gian" : "Tùy chỉnh"}
              {m === "all" ? <ChevronRight className="size-3.5 text-muted-foreground" /> : <CalendarDays className="size-3.5 text-muted-foreground" />}
            </span>
          </label>
        ))}
        {value.buyPeriod === "custom" && (
          <div className="space-y-1.5 pl-5.5">
            <input type="date" aria-label="Từ ngày" className={box} value={value.from} onChange={(e) => set({ from: e.target.value })} />
            <input type="date" aria-label="Đến ngày" className={box} value={value.to} onChange={(e) => set({ to: e.target.value })} />
          </div>
        )}
      </Section>
      <Section title="Nợ hiện tại">
        <Bound label="Từ" value={value.debtFrom} onCommit={(v) => set({ debtFrom: v })} />
        <Bound label="Tới" value={value.debtTo} onCommit={(v) => set({ debtTo: v })} />
      </Section>
      <Section title="Trạng thái">
        <div className="flex flex-wrap gap-1.5" role="radiogroup">
          {([["", "Tất cả"], ["active", "Đang hoạt động"], ["inactive", "Ngừng hoạt động"]] as const).map(([v, label]) => (
            <button key={v} type="button" role="radio" aria-checked={value.status === v} onClick={() => set({ status: v })}
              className={cn("h-[28px] rounded-full border px-3 text-[12px] transition-colors",
                value.status === v ? "border-primary bg-primary font-semibold text-white" : "border-[#d9dbe0] bg-white hover:border-primary hover:text-primary")}>
              {label}
            </button>
          ))}
        </div>
      </Section>
      {groupDialog && <SupplierGroupDialog group={groupDialog.group} onClose={() => setGroupDialog(null)}
        onSaved={(g) => set({ groupId: g?.id ?? "" })} />}
    </aside>
  );
}
