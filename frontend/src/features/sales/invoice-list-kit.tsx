"use client";

import { Search } from "lucide-react";
import { useT } from "@/lib/i18n";
import { salesNs } from "@/messages/sales";
import type { Period } from "./sales-queries";
import { cn } from "@/lib/utils";
import { DateRangePicker } from "@/components/ui/date-range-picker";

/**
 * Bộ khung trang danh sách kiểu KiotViet (Hóa đơn, Trả hàng, Sổ quỹ, Hóa đơn đầu vào):
 * tiêu đề, sidebar lọc 200px, ô tìm kiếm, nút toolbar, badge trạng thái.
 */

/** Header bảng danh sách: nền xanh nhạt. */
export const LIST_HEAD_ROW = "bg-primary-tint hover:bg-primary-tint";
/** Nút toolbar viền xanh (Tạo mới, Phiếu thu, Xuất file...). */
export const TOOLBAR_BTN = "h-[30px] rounded-md border-primary bg-background px-2.5 font-semibold text-primary hover:bg-primary/5 hover:text-primary";
/** Nút trong chân panel chi tiết (Lưu, Trả hàng, In...). */
export const DETAIL_BTN = "h-[30px] rounded-md px-2.5 font-semibold";
/** Header bảng con trong panel chi tiết. */
export const SUB_HEAD = "bg-[#eff0f3] text-left text-xs font-semibold [&_th]:h-[30px] [&_th]:px-2";
/** Khung panel chi tiết mở dưới dòng: viền xanh 1px, nền trắng. */
export const DETAIL_PANEL = "border border-primary bg-background text-[13px]";
/** TabsList variant="line" + TabsTrigger kiểu KiotViet (gạch chân xanh, viền dưới). */
export const DETAIL_TABS_LIST = "w-full justify-start gap-6 rounded-none border-b px-4 py-0 group-data-horizontal/tabs:h-10";
export const DETAIL_TAB = "flex-none px-0 font-medium data-active:text-primary after:bg-primary group-data-horizontal/tabs:after:bottom-0";
/** Ô input/select trong sidebar lọc. */
export const FILTER_FIELD = "h-[30px] w-full rounded-md border bg-background px-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-primary";

export function PageTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className={cn(!sub && "flex h-8 items-center")}>
      <h1 className="text-[18px] leading-6 font-bold">{children}</h1>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function FilterSidebar({ children, className }: { children: React.ReactNode; className?: string }) {
  return <aside className={cn("w-[200px] shrink-0 space-y-4 rounded-lg bg-background p-2.5 text-sm", className)}>{children}</aside>;
}

export function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-[13px] font-semibold">{title}</h3>
      {children}
    </section>
  );
}

export function RadioOption({ checked, onSelect, children }: { checked: boolean; onSelect: () => void; children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-2">
      <input type="radio" className="size-4 shrink-0 accent-primary" checked={checked} onChange={onSelect} />
      {children}
    </label>
  );
}

export function CheckOption({ checked, onChange, children }: { checked: boolean; onChange: (on: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-2">
      <input type="checkbox" className="size-4 shrink-0 rounded accent-primary" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {children}
    </label>
  );
}

/** Nhóm nút chọn 1 (VD: Hạch toán Tất cả / Có / Không). */
export function PillGroup({ value, options, onChange }: { value: string; options: readonly (readonly [string, string])[]; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(([v, l]) => (
        <button key={v} type="button" onClick={() => onChange(v)}
          className={cn("h-7 rounded-full border px-3", value === v ? "border-primary bg-primary text-white" : "bg-background hover:border-primary")}>{l}</button>))}
    </div>
  );
}

/** Lọc thời gian: Tháng này / Tùy chỉnh (khoảng ngày). */
export function PeriodFilter({ value, onChange, title, allowAll }: {
  value: Period; onChange: (p: Period) => void; title?: string; allowAll?: boolean;
}) {
  const t = useT(salesNs);
  const box = "flex h-[30px] flex-1 items-center justify-between rounded-md border bg-background px-2";
  return (
    <FilterSection title={title ?? t("listKit.time")}>
      <RadioOption checked={value.mode === "month"} onSelect={() => onChange({ ...value, mode: "month" })}>
        <span className={box}>{t("listKit.thisMonth")}</span></RadioOption>
      {allowAll && <RadioOption checked={value.mode === "all"} onSelect={() => onChange({ ...value, mode: "all" })}>
        <span className={box}>{t("listKit.allTime")}</span></RadioOption>}
      <RadioOption checked={value.mode === "custom"} onSelect={() => onChange({ ...value, mode: "custom" })}>
        <DateRangePicker className="flex-1" value={value.mode === "custom" ? value : null} onChange={(r) => onChange({ ...value, ...r, mode: "custom" })} />
      </RadioOption>
    </FilterSection>
  );
}

export function ListSearch({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative w-full max-w-[400px]">
      <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <input className="h-8 w-full rounded-md border bg-background pr-2.5 pl-8 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-primary"
        placeholder={placeholder} aria-label={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

const TONES = {
  green: "bg-[#e3f8ec] text-[#0f9d58]", red: "bg-[#fce4e4] text-[#d93025]",
  gray: "bg-[#eff0f3] text-foreground", blue: "bg-[#e3f0fc] text-primary",
} as const;

export function StatusBadge({ tone, children, title }: { tone: keyof typeof TONES; children: React.ReactNode; title?: string }) {
  return <span title={title} className={cn("inline-flex h-[22px] items-center gap-1 rounded px-1.5 text-xs font-medium whitespace-nowrap", TONES[tone])}>{children}</span>;
}
