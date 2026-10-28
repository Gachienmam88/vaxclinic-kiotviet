"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/number-input";
import { useBranches } from "@/features/settings/settings-queries";
import { useCurrentUser } from "@/lib/use-current-user";
import { newKey, type ProductForm } from "./product-form-state";
import { useTaxRates } from "./product-queries";
import { DatePicker } from "@/components/ui/date-picker";

export type SectionProps = { form: ProductForm; set: (patch: Partial<ProductForm>) => void; isCreate: boolean };

/** Khung có tiêu đề, mô tả, thu gọn được — như các khối trong form tạo hàng. */
export function FormSection({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="rounded-lg border border-[#e5e7eb]">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}
        className="flex w-full items-start justify-between gap-3 px-3 pt-3 pb-2 text-left">
        <span>
          <span className="block text-[13px] font-bold">{title}</span>
          {hint && <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>}
        </span>
        {open ? <ChevronUp className="size-4 shrink-0" /> : <ChevronDown className="size-4 shrink-0" />}
      </button>
      {open && <div className="px-3 pb-4">{children}</div>}
    </section>
  );
}

/** Native select gọn cho form dày đặc. */
export function NativeSelect(props: React.ComponentProps<"select">) {
  return (
    <select {...props}
      className="h-8 w-full rounded-md border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50" />
  );
}

export function PriceSection({ form, set }: SectionProps) {
  const { data: taxRates = [] } = useTaxRates();
  const base = form.units[0];
  const setBasePrice = (price: number) => set({ units: form.units.map((u, i) => (i === 0 ? { ...u, price } : u)) });
  return (
    <FormSection title="Giá vốn, giá bán">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="grid gap-1.5"><Label>Giá vốn</Label>
          <NumberInput value={form.cost} onValueChange={(cost) => set({ cost })} /></div>
        <div className="grid gap-1.5"><Label>Giá bán</Label>
          <NumberInput value={base.price} onValueChange={setBasePrice} /></div>
        <div className="grid gap-1.5"><Label>Tỷ lệ tính thuế</Label>
          <NativeSelect value={form.taxRateId} onChange={(e) => set({ taxRateId: e.target.value })}>
            <option value="">-- Chọn --</option>
            {taxRates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </NativeSelect></div>
        <div className="grid gap-1.5"><Label>Áp dụng giảm thuế</Label>
          <NativeSelect value={form.taxReduction ? "1" : "0"} onChange={(e) => set({ taxReduction: e.target.value === "1" })}>
            <option value="0">Không áp dụng</option><option value="1">Có áp dụng</option>
          </NativeSelect></div>
      </div>
    </FormSection>
  );
}

export function StockSection({ form, set, isCreate }: SectionProps) {
  const { data: me } = useCurrentUser();
  const { data: branches = [] } = useBranches();
  const myBranches = branches.filter((b) => me?.user.branches.some((x) => x.id === b.id));
  const setLot = (key: string, patch: object) =>
    set({ openingLots: form.openingLots.map((l) => (l.key === key ? { ...l, ...patch } : l)) });
  return (
    <FormSection title="Tồn kho" hint="Quản lý số lượng tồn kho và định mức tồn. Khi tồn chạm định mức, hệ thống sẽ cảnh báo.">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="grid gap-1.5"><Label>Quản lý theo lô, hạn sử dụng</Label>
          <NativeSelect value={form.lotManaged ? "1" : "0"} onChange={(e) => set({ lotManaged: e.target.value === "1" })}>
            <option value="0">Không</option><option value="1">Có</option>
          </NativeSelect></div>
        {isCreate && !form.lotManaged && (
          <div className="grid gap-1.5"><Label>Tồn kho</Label>
            <NumberInput value={form.openingQty} onValueChange={(openingQty) => set({ openingQty })} /></div>
        )}
        <div className="grid gap-1.5"><Label>Định mức tồn thấp nhất</Label>
          <NumberInput value={form.minStock} onValueChange={(minStock) => set({ minStock })} /></div>
        <div className="grid gap-1.5"><Label>Định mức tồn cao nhất</Label>
          <NumberInput value={form.maxStock} onValueChange={(maxStock) => set({ maxStock })} /></div>
      </div>
      {isCreate && myBranches.length > 1 && (
        <div className="mt-3 grid max-w-xs gap-1.5"><Label>Tồn đầu kỳ tại chi nhánh</Label>
          <NativeSelect value={form.openingBranchId} onChange={(e) => set({ openingBranchId: e.target.value })}>
            {myBranches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </NativeSelect></div>
      )}
      {isCreate && form.lotManaged && (
        <div className="mt-3 space-y-2">
          <Label>Tồn đầu kỳ theo lô</Label>
          {form.openingLots.map((l) => (
            <div key={l.key} className="grid grid-cols-[1fr_1fr_8rem_auto] items-center gap-2">
              <Input placeholder="Số lô" value={l.lotNumber} onChange={(e) => setLot(l.key, { lotNumber: e.target.value })} />
              <DatePicker value={l.expiryDate} onChange={(v) => setLot(l.key, { expiryDate: v })} />
              <NumberInput placeholder="Số lượng" value={l.quantity} onValueChange={(quantity) => setLot(l.key, { quantity })} />
              <Button type="button" variant="ghost" size="icon" aria-label="Xóa lô"
                onClick={() => set({ openingLots: form.openingLots.filter((x) => x.key !== l.key) })}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="link" className="px-0"
            onClick={() => set({ openingLots: [...form.openingLots, { key: newKey(), lotNumber: "", expiryDate: "", quantity: 0 }] })}>
            <Plus className="size-4" /> Thêm lô
          </Button>
        </div>
      )}
    </FormSection>
  );
}
