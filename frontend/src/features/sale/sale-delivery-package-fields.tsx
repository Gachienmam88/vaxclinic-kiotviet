"use client";

import { useState } from "react";
import { Box, Pencil, SquarePen } from "lucide-react";
import { NumberInput } from "@/components/number-input";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { saleNs } from "@/messages/sale";
import { lineField, type DeliverySet } from "./sale-delivery-draft";
import type { DeliveryDraft } from "./sale-types";

const UNIT_SELECT = "h-8 border-0 border-b border-[#c8ccd2] bg-transparent text-[13px] outline-none focus:border-primary";
const int = (n: number) => (n > 0 ? Math.round(n) : null);

/**
 * Kiện hàng (như KiotViet): "1 kiện" + bút sửa số kiện; trọng lượng gram/kg (lưu gram); kích thước D × R × C cm;
 * "Ghi chú cho bưu tá" (ghi chú vận đơn).
 */
export function SaleDeliveryPackageFields({ v, set }: { v: DeliveryDraft; set: DeliverySet }) {
  const t = useT(saleNs);
  const [editCount, setEditCount] = useState(false);
  const kg = v.weightUnit === "kg";
  const weightShown = v.weightGram == null ? 0 : kg ? v.weightGram / 1000 : v.weightGram;
  const dim = (key: "lengthCm" | "widthCm" | "heightCm", label: string) => (
    <NumberInput aria-label={label} title={label} className={cn(lineField, "w-12 text-center")} value={v[key] ?? 0}
      onValueChange={(n) => set({ [key]: int(n) })} />
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2.5">
        <Box className="size-[18px] shrink-0 fill-[#4b5563] text-white" aria-hidden />
        {editCount
          ? <NumberInput autoFocus aria-label={t("delivery.packageCount")} className={cn(lineField, "flex-1")} value={v.packageCount ?? 1}
              onValueChange={(n) => set({ packageCount: Math.max(1, Math.round(n) || 1) })} onBlur={() => setEditCount(false)} />
          : <span className="flex h-8 flex-1 items-center border-b border-[#c8ccd2]">{t("delivery.packages", { count: v.packageCount ?? 1 })}</span>}
        <button type="button" className="text-[#4b5563] hover:text-primary" aria-label={t("delivery.packageCount")} title={t("delivery.packageCount")}
          onClick={() => setEditCount(true)}><Pencil className="size-4" /></button>
      </div>
      <div className="flex items-center gap-2 pl-7">
        <NumberInput aria-label={t("delivery.weight")} title={t("delivery.weight")} className={cn(lineField, "w-14")} value={weightShown}
          onValueChange={(n) => set({ weightGram: n > 0 ? Math.round(kg ? n * 1000 : n) : null })} />
        <select aria-label={t("delivery.weightUnit")} className={UNIT_SELECT} value={kg ? "kg" : "g"}
          onChange={(e) => set({ weightUnit: e.target.value === "kg" ? "kg" : "g" })}>
          <option value="g">gram</option><option value="kg">kg</option>
        </select>
        <span className="ml-auto flex items-center gap-1.5 text-[#6b7280]">
          {dim("lengthCm", t("delivery.length"))}×{dim("widthCm", t("delivery.width"))}×{dim("heightCm", t("delivery.height"))}
        </span>
        <span className="text-[13px]">cm</span>
      </div>
      <div className="flex items-center gap-2.5">
        <SquarePen className="size-[18px] shrink-0 text-[#4b5563]" aria-hidden />
        <input className={cn(lineField, "flex-1")} aria-label={t("delivery.postmanNote")} placeholder={t("delivery.postmanNote")} maxLength={1000}
          value={v.note} onChange={(e) => set({ note: e.target.value })} />
      </div>
    </div>
  );
}
