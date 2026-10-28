"use client";

import { ChevronRight } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useUserLookup, type PurchaseFilters } from "./purchase-queries";
import { DateRangePicker } from "@/components/ui/date-range-picker";

type Props = {
  filters: PurchaseFilters;
  onChange: (f: PurchaseFilters) => void;
  statusLabels: Record<string, string>;
  personLabel?: string; // "Người nhập" | "Người trả"; bỏ trống = không có bộ lọc này (kiểm kho, xuất hủy)
  showInvoiceNo?: boolean;
};

/** Ô nhập / chọn trong bộ lọc: cao 30px, viền xám, bo 6px. */
const FIELD = "h-[30px] w-full rounded-md border border-[#d1d5db] bg-background px-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-primary";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="space-y-2"><h3 className="text-[13px] font-bold">{title}</h3>{children}</section>;
}

/** Bộ lọc trái 200px (Trạng thái, Thời gian, Người tạo, Số HĐ đầu vào, Người nhập/trả). */
export function PurchaseFilterSidebar({ filters, onChange, statusLabels, personLabel, showInvoiceNo }: Props) {
  const { data: users = [] } = useUserLookup();
  const set = (patch: Partial<PurchaseFilters>) => onChange({ ...filters, ...patch });
  const toggleStatus = (s: string, on: boolean) =>
    set({ statuses: on ? [...filters.statuses, s] : filters.statuses.filter((x) => x !== s) });
  const custom = filters.period === "custom";

  return (
    <aside className="w-[200px] space-y-4 rounded-lg bg-background p-2.5">
      <Section title="Trạng thái">
        {Object.keys(statusLabels).map((s) => (
          <label key={s} className="flex items-center gap-2 text-sm">
            <Checkbox checked={filters.statuses.includes(s)} onCheckedChange={(v) => toggleStatus(s, v === true)} />
            {statusLabels[s]}
          </label>
        ))}
      </Section>
      <Section title="Thời gian">
        <label className="flex items-center gap-2">
          <input type="radio" name="purchase-period" className="size-4 shrink-0 accent-primary" checked={!custom}
            onChange={() => set({ period: "month" })} />
          <span className={`${FIELD} flex items-center justify-between`}>Tháng này <ChevronRight className="size-4 text-muted-foreground" /></span>
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="purchase-period" className="size-4 shrink-0 accent-primary" checked={custom}
            onChange={() => set({ period: "custom" })} />
          <DateRangePicker className={FIELD} value={custom ? filters : null} onChange={(r) => set({ ...r, period: "custom" })} />
        </label>
      </Section>
      <Section title="Người tạo">
        <select className={FIELD} value={filters.createdBy} onChange={(e) => set({ createdBy: e.target.value })} aria-label="Người tạo">
          <option value="">Chọn người tạo</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
        </select>
      </Section>
      {showInvoiceNo && (
        <Section title="Số hóa đơn đầu vào">
          <input className={FIELD} placeholder="Theo số hóa đơn đầu vào" value={filters.inputInvoiceNo}
            aria-label="Số hóa đơn đầu vào" onChange={(e) => set({ inputInvoiceNo: e.target.value })} />
        </Section>
      )}
      {personLabel && <Section title={personLabel}>
        <select className={FIELD} value={filters.personId} onChange={(e) => set({ personId: e.target.value })} aria-label={personLabel}>
          <option value="">Chọn {personLabel.toLowerCase()}</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
        </select>
      </Section>}
    </aside>
  );
}
