"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FormulaOp } from "./price-book-types";
import { useT } from "@/lib/i18n";
import { productsNs } from "@/messages/products";

type Props = {
  op: FormulaOp;
  onOp: (op: FormulaOp) => void;
  /** Chuỗi số người dùng gõ (cho phép trống khi đang sửa). */
  value: string;
  onValue: (v: string) => void;
  percent: boolean;
  onPercent: (pct: boolean) => void;
  disabled?: boolean;
};

/** Phần "(+) (−) [giá trị] [VND | %]" của công thức giá KiotViet (popover đặt giá + hộp thoại tạo bảng giá). */
export function FormulaOpValueInputs({ op, onOp, value, onValue, percent, onPercent, disabled }: Props) {
  const t = useT(productsNs);
  const round = (active: boolean) => cn("inline-flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors disabled:opacity-50",
    active ? "border-primary bg-primary text-primary-foreground" : "border-[#9ca3af] bg-background text-[#4b5563] hover:border-primary");
  const seg = (active: boolean) => cn("h-6 rounded px-1.5 text-xs font-semibold disabled:opacity-50",
    active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground");
  return (
    <div className="flex items-center gap-2">
      <button type="button" aria-label={t("formulaPopover.plus")} aria-pressed={op === "PLUS"} disabled={disabled}
        className={round(op === "PLUS")} onClick={() => onOp("PLUS")}><Plus className="size-3.5" /></button>
      <button type="button" aria-label={t("formulaPopover.minus")} aria-pressed={op === "MINUS"} disabled={disabled}
        className={round(op === "MINUS")} onClick={() => onOp("MINUS")}><Minus className="size-3.5" /></button>
      <div className={cn("flex h-8 min-w-0 flex-1 items-center rounded-md border border-input bg-background pr-1 focus-within:border-primary",
        disabled && "bg-muted")}>
        <input aria-label={t("formula.value")} inputMode="decimal" disabled={disabled} value={value}
          onChange={(e) => /^\d*\.?\d*$/.test(e.target.value) && onValue(e.target.value)}
          className="h-full min-w-0 flex-1 bg-transparent px-2 text-right text-[13px] outline-none disabled:text-muted-foreground" />
        <button type="button" aria-pressed={!percent} disabled={disabled} className={seg(!percent)} onClick={() => onPercent(false)}>VND</button>
        <button type="button" aria-pressed={percent} disabled={disabled} className={seg(percent)} onClick={() => onPercent(true)}>%</button>
      </div>
    </div>
  );
}

/** Giá mới = gốc ± giá trị (VNĐ hoặc %), làm tròn VNĐ, không âm — giống price_book_formula ở DB. */
export function applyFormula(base: number, op: FormulaOp, value: number, percent: boolean) {
  const delta = op === "MINUS" ? -value : value;
  return Math.max(0, Math.round(percent ? base * (1 + delta / 100) : base + delta));
}
