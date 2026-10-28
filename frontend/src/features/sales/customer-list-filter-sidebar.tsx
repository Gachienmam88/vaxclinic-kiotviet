"use client";

import { CalendarDays, ChevronRight } from "lucide-react";
import { useUserLookup } from "@/features/purchases/purchase-queries";
import { cn } from "@/lib/utils";
import { useCustomerGroups, type Period } from "./sales-queries";

export type CustomerFilters = {
  group: string; period: Period; createdBy: string;
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
          <option value="">Tất cả các nhóm</option>{groups.map((g) => <option key={g}>{g}</option>)}
        </select>
      </Section>
      <Section title="Ngày tạo">
        {(["all", "custom"] as const).map((m) => (
          <label key={m} className="flex cursor-pointer items-center gap-2">
            <input type="radio" name="created-period" className="size-3.5 accent-primary" checked={period.mode === m}
              onChange={() => set("period")({ ...period, mode: m })} />
            <span className={cn(box, "flex items-center justify-between")}>
              {m === "all" ? "Toàn thời gian" : "Tùy chỉnh"}
              {m === "all" ? <ChevronRight className="size-3.5 text-muted-foreground" /> : <CalendarDays className="size-3.5 text-muted-foreground" />}
            </span>
          </label>
        ))}
        {period.mode === "custom" && (
          <div className="space-y-1.5 pl-5.5">
            <input type="date" aria-label="Từ ngày" className={box} value={period.from} onChange={(e) => set("period")({ ...period, from: e.target.value })} />
            <input type="date" aria-label="Đến ngày" className={box} value={period.to} onChange={(e) => set("period")({ ...period, to: e.target.value })} />
          </div>
        )}
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
