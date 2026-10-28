"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { FILTER_FIELD, FilterSection, FilterSidebar, PageTitle, PillGroup } from "@/features/sales/invoice-list-kit";
import { useCustomers } from "@/features/sales/sales-queries";
import { useCurrentUser } from "@/lib/use-current-user";

/** Bộ khung trang báo cáo: tiêu đề + sidebar lọc bên trái + vùng biểu đồ / báo cáo bên phải. */
export function ReportLayout({ title, sidebar, children }: { title: string; sidebar: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <PageTitle>{title}</PageTitle>
      <div className="flex items-start gap-2">
        <FilterSidebar className="sticky top-2 max-h-[calc(100vh-90px)] overflow-y-auto">{sidebar}</FilterSidebar>
        <div className="min-w-0 flex-1 space-y-3">{children}</div>
      </div>
    </div>
  );
}

export type ViewMode = "chart" | "report";

/** Kiểu hiển thị: Biểu đồ / Báo cáo (reportOnly: chỉ có nút Báo cáo). */
export function ViewModeFilter({ value, onChange, reportOnly }: { value: ViewMode; onChange: (v: ViewMode) => void; reportOnly?: boolean }) {
  const opts = reportOnly ? ([["report", "Báo cáo"]] as const) : ([["chart", "Biểu đồ"], ["report", "Báo cáo"]] as const);
  return (
    <FilterSection title="Kiểu hiển thị">
      <PillGroup value={value} options={opts} onChange={(v) => onChange(v as ViewMode)} />
      <hr className="mt-3" />
    </FilterSection>
  );
}

/** Ô chọn (native select) có tiêu đề; options [giá trị, nhãn]. placeholder = lựa chọn rỗng. */
export function SelectFilter({ title, value, options, onChange, placeholder, disabled, hint }: {
  title?: string; value: string; options: readonly (readonly [string, string])[]; onChange: (v: string) => void;
  placeholder?: string; disabled?: boolean; hint?: string;
}) {
  const select = (
    <select className={FILTER_FIELD} aria-label={title ?? placeholder} value={value} disabled={disabled} title={hint}
      onChange={(e) => onChange(e.target.value)}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
  return title ? <FilterSection title={title}>{select}</FilterSection> : select;
}

export function CheckFilter({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[13px]">
      <input type="checkbox" className="size-4 accent-primary" checked={checked} onChange={(e) => onChange(e.target.checked)} />{children}
    </label>
  );
}

/** Ô nhập tìm kiếm (trễ 400ms rồi mới lọc). */
export function TextFilter({ title, value, onChange, placeholder }: { title: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  const [text, setText] = useState(value);
  useEffect(() => { const t = setTimeout(() => { if (text !== value) onChange(text.trim()); }, 400); return () => clearTimeout(t); }, [text, value, onChange]);
  return (
    <FilterSection title={title}>
      <input className={FILTER_FIELD} placeholder={placeholder} aria-label={title} value={text} onChange={(e) => setText(e.target.value)} />
    </FilterSection>
  );
}

export type PickedCustomer = { id: string; label: string } | null;

/** Khách hàng: gõ mã / tên / SĐT → chọn 1 khách trong danh sách gợi ý. */
export function CustomerFilter({ value, onChange }: { value: PickedCustomer; onChange: (c: PickedCustomer) => void }) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => { const t = setTimeout(() => setDebounced(q.trim()), 300); return () => clearTimeout(t); }, [q]);
  const { data } = useCustomers(new URLSearchParams({ q: debounced, size: "8" }));
  const show = !value && debounced.length > 0;
  return (
    <FilterSection title="Khách hàng">
      {value ? (
        <div className="flex h-[30px] items-center justify-between rounded-md border bg-[#e3f0fc] px-2 text-[13px]">
          <span className="truncate">{value.label}</span>
          <button type="button" aria-label="Bỏ chọn khách" onClick={() => { onChange(null); setQ(""); }}><X className="size-3.5" /></button>
        </div>
      ) : (
        <div className="relative">
          <input className={FILTER_FIELD} placeholder="Theo mã, tên, số điện thoại" aria-label="Khách hàng" value={q} onChange={(e) => setQ(e.target.value)} />
          {show && (
            <div className="absolute inset-x-0 top-8 z-30 max-h-64 overflow-y-auto rounded-md border bg-background shadow-lg">
              {!data?.items.length && <p className="p-2 text-xs text-muted-foreground">Không tìm thấy khách hàng</p>}
              {data?.items.map((c) => (
                <button key={c.id} type="button" className="block w-full px-2 py-1.5 text-left text-xs hover:bg-[#e3f0fc]"
                  onClick={() => onChange({ id: c.id, label: `${c.name} (${c.code})` })}>
                  <b>{c.name}</b><br /><span className="text-muted-foreground">{c.code}{c.phone ? ` · ${c.phone}` : ""}</span></button>))}
            </div>)}
        </div>)}
    </FilterSection>
  );
}

/** Chi nhánh của người dùng (chỉ hiện khi làm việc ở > 1 chi nhánh). Rỗng = tất cả chi nhánh được làm việc. */
export function BranchFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data } = useCurrentUser();
  const branches = data?.user.branches ?? [];
  if (branches.length < 2) return null;
  return <SelectFilter title="Chi nhánh" value={value} onChange={onChange} placeholder="Tất cả chi nhánh" options={branches.map((b) => [b.id, b.name] as const)} />;
}

/** Tên chi nhánh in trên báo cáo: chi nhánh đang lọc, hoặc tất cả chi nhánh người dùng làm việc. */
export function useBranchLabel(branchId: string) {
  const { data } = useCurrentUser();
  const branches = data?.user.branches ?? [];
  return (branchId ? branches.filter((b) => b.id === branchId) : branches).map((b) => b.name).join(", ");
}
