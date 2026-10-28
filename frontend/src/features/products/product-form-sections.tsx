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
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { productsNs } from "@/messages/products";

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
  const t = useT(productsNs);
  const base = form.units[0];
  const setBasePrice = (price: number) => set({ units: form.units.map((u, i) => (i === 0 ? { ...u, price } : u)) });
  return (
    <FormSection title={t("form.priceSection")}>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="grid gap-1.5"><Label>{t("fields.cost")}</Label>
          <NumberInput value={form.cost} onValueChange={(cost) => set({ cost })} /></div>
        <div className="grid gap-1.5"><Label>{t("fields.price")}</Label>
          <NumberInput value={base.price} onValueChange={setBasePrice} /></div>
        <div className="grid gap-1.5"><Label>{t("fields.taxRate")}</Label>
          <NativeSelect value={form.taxRateId} onChange={(e) => set({ taxRateId: e.target.value })}>
            <option value="">{t("form.pickOption")}</option>
            {taxRates.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </NativeSelect></div>
        <div className="grid gap-1.5"><Label>{t("fields.taxReduction")}</Label>
          <NativeSelect value={form.taxReduction ? "1" : "0"} onChange={(e) => set({ taxReduction: e.target.value === "1" })}>
            <option value="0">{t("fields.taxReductionNo")}</option><option value="1">{t("fields.taxReductionYes")}</option>
          </NativeSelect></div>
      </div>
    </FormSection>
  );
}

export function StockSection({ form, set, isCreate }: SectionProps) {
  const { data: me } = useCurrentUser();
  const { data: branches = [] } = useBranches();
  const t = useT(productsNs);
  const tc = useT(commonNs);
  const myBranches = branches.filter((b) => me?.user.branches.some((x) => x.id === b.id));
  const setLot = (key: string, patch: object) =>
    set({ openingLots: form.openingLots.map((l) => (l.key === key ? { ...l, ...patch } : l)) });
  return (
    <FormSection title={t("fields.stock")} hint={t("form.stockHint")}>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="grid gap-1.5"><Label>{t("fields.lotManaged")}</Label>
          <NativeSelect value={form.lotManaged ? "1" : "0"} onChange={(e) => set({ lotManaged: e.target.value === "1" })}>
            <option value="0">{tc("status.no")}</option><option value="1">{tc("status.yes")}</option>
          </NativeSelect></div>
        {isCreate && !form.lotManaged && (
          <div className="grid gap-1.5"><Label>{t("fields.stock")}</Label>
            <NumberInput value={form.openingQty} onValueChange={(openingQty) => set({ openingQty })} /></div>
        )}
        <div className="grid gap-1.5"><Label>{t("fields.minStock")}</Label>
          <NumberInput value={form.minStock} onValueChange={(minStock) => set({ minStock })} /></div>
        <div className="grid gap-1.5"><Label>{t("fields.maxStock")}</Label>
          <NumberInput value={form.maxStock} onValueChange={(maxStock) => set({ maxStock })} /></div>
      </div>
      {isCreate && myBranches.length > 1 && (
        <div className="mt-3 grid max-w-xs gap-1.5"><Label>{t("form.openingBranch")}</Label>
          <NativeSelect value={form.openingBranchId} onChange={(e) => set({ openingBranchId: e.target.value })}>
            {myBranches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </NativeSelect></div>
      )}
      {isCreate && form.lotManaged && (
        <div className="mt-3 space-y-2">
          <Label>{t("form.openingLots")}</Label>
          {form.openingLots.map((l) => (
            <div key={l.key} className="grid grid-cols-[1fr_1fr_8rem_auto] items-center gap-2">
              <Input placeholder={t("fields.lotNumber")} value={l.lotNumber} onChange={(e) => setLot(l.key, { lotNumber: e.target.value })} />
              <DatePicker value={l.expiryDate} onChange={(v) => setLot(l.key, { expiryDate: v })} />
              <NumberInput placeholder={t("fields.quantity")} value={l.quantity} onValueChange={(quantity) => setLot(l.key, { quantity })} />
              <Button type="button" variant="ghost" size="icon" aria-label={t("form.removeLot")}
                onClick={() => set({ openingLots: form.openingLots.filter((x) => x.key !== l.key) })}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="link" className="px-0"
            onClick={() => set({ openingLots: [...form.openingLots, { key: newKey(), lotNumber: "", expiryDate: "", quantity: 0 }] })}>
            <Plus className="size-4" /> {t("form.addLot")}
          </Button>
        </div>
      )}
    </FormSection>
  );
}
