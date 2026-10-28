"use client";

import { useState } from "react";
import { formatNumber, parseNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export type Rate = { rateType: "PERCENT" | "AMOUNT"; value: number } | null;

/**
 * Ô nhập mức hoa hồng: số + nút chuyển "%" (theo % doanh thu) / "VNĐ" (số tiền trên 1 đơn vị bán).
 * Rời ô / đổi đơn vị → onSave (giá trị trống = bỏ hoa hồng của mặt hàng).
 */
export function CommissionRateCell({ rate, onSave, label }: { rate: Rate; onSave: (r: Rate) => void; label: string }) {
  const [text, setText] = useState(rate ? formatNumber(rate.value) : "");
  const [type, setType] = useState<"PERCENT" | "AMOUNT">(rate?.rateType ?? "PERCENT");
  const commit = (nextType: "PERCENT" | "AMOUNT", nextText: string) => {
    const next: Rate = nextText.trim() === "" ? null : { rateType: nextType, value: parseNumber(nextText) };
    const same = (next === null && rate === null)
      || (next !== null && rate !== null && next.rateType === rate.rateType && next.value === Number(rate.value));
    if (!same) onSave(next);
  };
  return (
    <div className="flex items-center justify-end gap-1">
      <input aria-label={label} value={text} inputMode="decimal"
        className="h-6 w-20 rounded border border-transparent border-b-[#d9dbe0] px-1 text-right outline-none hover:border-[#d9dbe0] focus:border-primary"
        onChange={(e) => setText(e.target.value.replace(/[^\d.,]/g, ""))}
        onBlur={() => commit(type, text)} />
      <button type="button" aria-label={`Đổi đơn vị ${label}`}
        className={cn("h-6 w-9 rounded text-[11px] font-semibold", type === "PERCENT" ? "bg-[#e3f0fc] text-primary" : "bg-[#eff0f3]")}
        onClick={() => { const t = type === "PERCENT" ? "AMOUNT" : "PERCENT"; setType(t); if (text.trim()) commit(t, text); }}>
        {type === "PERCENT" ? "%" : "VNĐ"}
      </button>
    </div>
  );
}
