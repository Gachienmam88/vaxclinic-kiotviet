"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/features/products/product-form-sections";
import { useUserLookup, type PurchaseFilters } from "./purchase-queries";
import type { DocStatus } from "./purchase-types";

type Props = {
  filters: PurchaseFilters;
  onChange: (f: PurchaseFilters) => void;
  statusLabels: Record<DocStatus, string>;
  personLabel: string; // "Người nhập" | "Người trả"
  showInvoiceNo?: boolean;
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="space-y-2"><h3 className="text-sm font-semibold">{title}</h3>{children}</section>;
}

export function PurchaseFilterSidebar({ filters, onChange, statusLabels, personLabel, showInvoiceNo }: Props) {
  const { data: users = [] } = useUserLookup();
  const set = (patch: Partial<PurchaseFilters>) => onChange({ ...filters, ...patch });
  const toggleStatus = (s: DocStatus, on: boolean) =>
    set({ statuses: on ? [...filters.statuses, s] : filters.statuses.filter((x) => x !== s) });

  return (
    <aside className="w-60 shrink-0 space-y-5 rounded-lg bg-background p-4">
      <Section title="Trạng thái">
        {(Object.keys(statusLabels) as DocStatus[]).map((s) => (
          <label key={s} className="flex items-center gap-2 text-sm">
            <Checkbox checked={filters.statuses.includes(s)} onCheckedChange={(v) => toggleStatus(s, v === true)} />
            {statusLabels[s]}
          </label>
        ))}
      </Section>
      <Section title="Thời gian">
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" className="accent-primary" checked={filters.period === "month"} onChange={() => set({ period: "month" })} />
          Tháng này
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" className="accent-primary" checked={filters.period === "custom"} onChange={() => set({ period: "custom" })} />
          Tùy chỉnh
        </label>
        {filters.period === "custom" && (
          <div className="grid gap-1.5 text-sm">
            <Input type="date" value={filters.from} onChange={(e) => set({ from: e.target.value })} aria-label="Từ ngày" />
            <Input type="date" value={filters.to} onChange={(e) => set({ to: e.target.value })} aria-label="Đến ngày" />
          </div>
        )}
      </Section>
      <Section title="Người tạo">
        <NativeSelect value={filters.createdBy} onChange={(e) => set({ createdBy: e.target.value })}>
          <option value="">Chọn người tạo</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
        </NativeSelect>
      </Section>
      {showInvoiceNo && (
        <Section title="Số hóa đơn đầu vào">
          <Input placeholder="Theo số hóa đơn đầu vào" value={filters.inputInvoiceNo}
            onChange={(e) => set({ inputInvoiceNo: e.target.value })} />
        </Section>
      )}
      <Section title={personLabel}>
        <NativeSelect value={filters.personId} onChange={(e) => set({ personId: e.target.value })}>
          <option value="">Chọn {personLabel.toLowerCase()}</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
        </NativeSelect>
      </Section>
    </aside>
  );
}
