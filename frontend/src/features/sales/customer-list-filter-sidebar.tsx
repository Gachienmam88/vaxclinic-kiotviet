"use client";

import { ChevronRight } from "lucide-react";
import { useUserLookup } from "@/features/purchases/purchase-queries";
import { cn } from "@/lib/utils";
import { useCustomerGroups, type Period } from "./sales-queries";
import { DateRangePicker } from "@/components/ui/date-range-picker";

export type CustomerFilters = {
  group: string; period: Period; createdBy: string; // group = id nhóm khách hàng
  type: "" | "PERSONAL" | "COMPANY"; gender: "" | "MALE" | "FEMALE";
};

/** Ô chọn kiểu KiotViet: viền xám nhạt, cao 26px, bo 4px. */
const box = "h-[26px] w-full rounded-[4px] border border-[#d9dbe0] bg-white px-2.5 text-[12px] outline-none focus:border-primary";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-[12px] font-bold">{title}</div>
      {children}
    </div>
  );
}

/** Nhóm nút bo tròn (Tất cả / Cá nhân / Công ty) — nút chọn nền xanh. */
function Pills<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup">
      {options.map(([v, label]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}
          className={cn("h-[26px] rounded-full border px-2.5 text-[12px] transition-colors",
            value === v ? "border-primary bg-primary font-semibold text-white" : "border-[#d9dbe0] bg-white hover:border-primary hover:text-primary")}>
          {label}
        </button>
      ))}
    </div>
  );
}

/** Bộ lọc bên trái màn Khách hàng: Nhóm, Ngày tạo, Người tạo, Loại khách hàng, Giới tính. */
export function CustomerListFilterSidebar({ value, onChange }: { value: CustomerFilters; onChange: (v: CustomerFilters) => void }) {
  const { data: groups = [] } = useCustomerGroups();
  const { data: users = [] } = useUserLookup();
  const set = <K extends keyof CustomerFilters>(k: K) => (v: CustomerFilters[K]) => onChange({ ...value, [k]: v });
  const { period } = value;
  return (
    <aside className="space-y-5 rounded-lg bg-white p-2.5 text-[12px]">
      <Section title="Nhóm khách hàng">
        <select className={box} value={value.group} onChange={(e) => set("group")(e.target.value)} aria-label="Nhóm khách hàng">
          <option value="">Tất cả các nhóm</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </Section>
      <Section title="Ngày tạo">
        {(["all", "custom"] as const).map((m) => (
          <label key={m} className="flex cursor-pointer items-center gap-2">
            <input type="radio" name="created-period" className="size-3.5 accent-primary" checked={period.mode === m}
              onChange={() => set("period")({ ...period, mode: m })} />
            {m === "all" ? (
              <span className={cn(box, "flex items-center justify-between")}>
                Toàn thời gian <ChevronRight className="size-3.5 text-muted-foreground" />
              </span>
            ) : (
              <DateRangePicker className={cn(box, "flex items-center justify-between")} value={period.mode === "custom" ? period : null}
                onChange={(r) => set("period")({ ...period, ...r, mode: "custom" })} />
            )}
          </label>
        ))}
      </Section>
      <Section title="Người tạo">
        <select className={cn(box, !value.createdBy && "text-muted-foreground")} value={value.createdBy}
          onChange={(e) => set("createdBy")(e.target.value)} aria-label="Người tạo">
          <option value="">Chọn người tạo</option>{users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
        </select>
      </Section>
      <Section title="Loại khách hàng">
        <Pills value={value.type} onChange={set("type")} options={[["", "Tất cả"], ["PERSONAL", "Cá nhân"], ["COMPANY", "Công ty"]]} />
      </Section>
      <Section title="Giới tính">
        <Pills value={value.gender} onChange={set("gender")} options={[["", "Tất cả"], ["MALE", "Nam"], ["FEMALE", "Nữ"]]} />
      </Section>
    </aside>
  );
}
