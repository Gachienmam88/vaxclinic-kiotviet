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
import { emptyUnit, type UnitForm } from "./product-form-state";
import { FormSection, NativeSelect, type SectionProps } from "./product-form-sections";
import { usePositions } from "./product-queries";

export function PositionWeightSection({ form, set }: SectionProps) {
  const qc = useQueryClient();
  const { data: positions = [] } = usePositions();
  async function createPosition() {
    const name = prompt("Tên vị trí mới (VD: Tủ lạnh số 1)")?.trim();
    if (!name) return;
    try {
      const p = await api<{ id: string }>("/positions", { method: "POST", body: { name } });
      await qc.invalidateQueries({ queryKey: ["positions"] });
      set({ positionId: p.id });
    } catch (e) { toast.error(errorMessage(e)); }
  }
  return (
    <FormSection title="Vị trí, trọng lượng" hint="Quản lý việc sắp xếp kho, vị trí bán hàng hoặc trọng lượng hàng hóa">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="grid gap-1.5">
          <div className="flex justify-between"><Label>Vị trí</Label>
            <button type="button" className="text-xs text-primary" onClick={createPosition}>Tạo mới</button></div>
          <NativeSelect value={form.positionId} onChange={(e) => set({ positionId: e.target.value })}>
            <option value="">Chọn vị trí</option>
            {positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </NativeSelect>
        </div>
        <div className="grid gap-1.5"><Label>Trọng lượng</Label>
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
  return (
    <FormSection title="Quản lý theo đơn vị tính">
      <div className="mb-3">
        <div className="text-xs font-bold">Đơn vị tính</div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          Thêm đơn vị bán hoặc nhập như liều, hộp. Đặt giá trị quy đổi để tính nhanh giá và tồn kho. Ví dụ: 1 hộp = 10 liều.
        </div>
      </div>
      <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-[10.5rem_6rem_auto]">
        <div className="grid gap-1.5"><Label>Tên đơn vị cơ bản</Label>
          <Input required placeholder="Nhập tên đơn vị cơ bản" value={base.unitName}
            onChange={(e) => update(base.key, { unitName: e.target.value })} /></div>
        <div className="grid gap-1.5"><Label>Giá bán</Label>
          <NumberInput value={base.price} onValueChange={(price) => update(base.key, { price })} /></div>
        <label className="flex h-8 items-center gap-2 text-[13px]">
          <Checkbox checked={base.directSale} onCheckedChange={(v) => update(base.key, { directSale: v === true })} />
          Bán trực tiếp
        </label>
      </div>
      {others.length > 0 && (
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-[1fr_7rem_9rem_9rem_7rem_auto] gap-2 text-xs font-medium text-muted-foreground">
            <span>Tên đơn vị</span><span>Giá trị quy đổi</span><span>Giá bán</span><span>Mã hàng</span>
            <span>Bán trực tiếp</span><span />
          </div>
          {others.map((u) => (
            <div key={u.key} className="grid grid-cols-[1fr_7rem_9rem_9rem_7rem_auto] items-center gap-2">
              <Input required placeholder="VD: Hộp" value={u.unitName} onChange={(e) => update(u.key, { unitName: e.target.value })} />
              <NumberInput value={u.conversionRate} onValueChange={(conversionRate) =>
                update(u.key, { conversionRate, price: u.price || conversionRate * base.price })} />
              <NumberInput value={u.price} onValueChange={(price) => update(u.key, { price })} />
              <Input placeholder="Tự động" value={u.code} onChange={(e) => update(u.key, { code: e.target.value })} />
              <Checkbox checked={u.directSale} onCheckedChange={(v) => update(u.key, { directSale: v === true })} />
              <Button type="button" variant="ghost" size="icon" aria-label="Xóa đơn vị"
                onClick={() => set({ units: form.units.filter((x) => x.key !== u.key) })}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <Button type="button" variant="link" className="mt-2 px-0 font-semibold hover:no-underline" onClick={() => set({ units: [...form.units, emptyUnit()] })}>
        <Plus className="size-4" /> Thêm đơn vị
      </Button>
    </FormSection>
  );
}
