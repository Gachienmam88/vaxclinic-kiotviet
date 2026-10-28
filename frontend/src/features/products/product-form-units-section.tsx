"use client";

import { Plus, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/number-input";
import { api, errorMessage } from "@/lib/api-client";
import { useT } from "@/lib/i18n";
import { productsNs } from "@/messages/products";
import { emptyUnit, type UnitForm } from "./product-form-state";
import { FormSection, NativeSelect, type SectionProps } from "./product-form-sections";
import { usePositions } from "./product-queries";

export function PositionWeightSection({ form, set }: SectionProps) {
  const qc = useQueryClient();
  const { data: positions = [] } = usePositions();
  const t = useT(productsNs);
  async function createPosition() {
    const name = prompt(t("form.promptNewPosition"))?.trim();
    if (!name) return;
    try {
      const p = await api<{ id: string }>("/positions", { method: "POST", body: { name } });
      await qc.invalidateQueries({ queryKey: ["positions"] });
      set({ positionId: p.id });
    } catch (e) { toast.error(errorMessage(e)); }
  }
  return (
    <FormSection title={t("form.positionSection")} hint={t("form.positionHint")}>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="grid gap-1.5">
          <div className="flex justify-between"><Label>{t("fields.position")}</Label>
            <button type="button" className="text-xs text-primary" onClick={createPosition}>{t("form.createNew")}</button></div>
          <NativeSelect value={form.positionId} onChange={(e) => set({ positionId: e.target.value })}>
            <option value="">{t("form.pickPosition")}</option>
            {positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </NativeSelect>
        </div>
        <div className="grid gap-1.5"><Label>{t("fields.weight")}</Label>
          <div className="flex gap-2">
            <NumberInput value={form.weight} onValueChange={(weight) => set({ weight })} />
            <NativeSelect className="w-20" value={form.weightUnit}
              onChange={(e) => set({ weightUnit: e.target.value as "g" | "kg" })} style={{ width: 80 }}>
              <option value="g">g</option><option value="kg">kg</option>
            </NativeSelect>
          </div>
        </div>
      </div>
    </FormSection>
  );
}

/** Đơn vị cơ bản + đơn vị quy đổi (VD: 1 Hộp = 10 Liều). Mỗi đơn vị có mã hàng riêng. */
export function UnitsSection({ form, set }: SectionProps) {
  const update = (key: string, patch: Partial<UnitForm>) =>
    set({ units: form.units.map((u) => (u.key === key ? { ...u, ...patch } : u)) });
  const [base, ...others] = form.units;
  const t = useT(productsNs);
  return (
    <FormSection title={t("form.unitsSection")}>
      <div className="mb-3">
        <div className="text-xs font-bold">{t("fields.units")}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {t("form.unitsHint")}
        </div>
      </div>
      <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-[10.5rem_6rem_auto]">
        <div className="grid gap-1.5"><Label>{t("form.baseUnitName")}</Label>
          <Input required placeholder={t("form.baseUnitPlaceholder")} value={base.unitName}
            onChange={(e) => update(base.key, { unitName: e.target.value })} /></div>
        <div className="grid gap-1.5"><Label>{t("fields.price")}</Label>
          <NumberInput value={base.price} onValueChange={(price) => update(base.key, { price })} /></div>
        <label className="flex h-8 items-center gap-2 text-[13px]">
          <Checkbox checked={base.directSale} onCheckedChange={(v) => update(base.key, { directSale: v === true })} />
          {t("fields.directSale")}
        </label>
      </div>
      {others.length > 0 && (
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-[1fr_7rem_9rem_9rem_7rem_auto] gap-2 text-xs font-medium text-muted-foreground">
            <span>{t("form.unitName")}</span><span>{t("fields.conversionRate")}</span><span>{t("fields.price")}</span><span>{t("fields.code")}</span>
            <span>{t("fields.directSale")}</span><span />
          </div>
          {others.map((u) => (
            <div key={u.key} className="grid grid-cols-[1fr_7rem_9rem_9rem_7rem_auto] items-center gap-2">
              <Input required placeholder={t("form.unitPlaceholder")} value={u.unitName} onChange={(e) => update(u.key, { unitName: e.target.value })} />
              <NumberInput value={u.conversionRate} onValueChange={(conversionRate) =>
                update(u.key, { conversionRate, price: u.price || conversionRate * base.price })} />
              <NumberInput value={u.price} onValueChange={(price) => update(u.key, { price })} />
              <Input placeholder={t("form.auto")} value={u.code} onChange={(e) => update(u.key, { code: e.target.value })} />
              <Checkbox checked={u.directSale} onCheckedChange={(v) => update(u.key, { directSale: v === true })} />
              <Button type="button" variant="ghost" size="icon" aria-label={t("form.removeUnit")}
                onClick={() => set({ units: form.units.filter((x) => x.key !== u.key) })}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <Button type="button" variant="link" className="mt-2 px-0 font-semibold hover:no-underline" onClick={() => set({ units: [...form.units, emptyUnit()] })}>
        <Plus className="size-4" /> {t("form.addUnit")}
      </Button>
    </FormSection>
  );
}
