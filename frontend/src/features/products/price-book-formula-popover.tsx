"use client";

import { useMemo, useState } from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { errorMessage } from "@/lib/api-client";
import { formatMoney } from "@/lib/format";
import { zoomAwarePositioning } from "@/lib/zoom-aware-floating-anchor";
import { applyFormula, FormulaOpValueInputs } from "./price-book-formula-inputs";
import { useApplyFormula } from "./price-book-queries";
import {
  BASE_BOOK_ID, type FormulaBase, type FormulaOp, type PriceBook, type PriceRow, type PriceRowFilters,
} from "./price-book-types";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { productsNs } from "@/messages/products";

/** Cột đang đặt giá: 1 bảng giá, hoặc Bảng giá chung (id = BASE_BOOK_ID). */
export type PriceTarget = { id: string; name: string };

type Props = {
  anchor: HTMLElement;
  target: PriceTarget;
  row: PriceRow;
  books: PriceBook[];
  /** Số hàng thuộc bộ lọc hiện tại (câu "Áp dụng ... cho tất cả N hàng hóa"). */
  total: number;
  filters: PriceRowFilters;
  compareBookId: string | null;
  onClose: () => void;
};

const BOOK_PREFIX = "BOOK:";

/**
 * "Đặt giá theo công thức" (KiotViet): Giá mới = [Giá hiện tại | Giá vốn | Giá nhập cuối | Bảng giá chung | bảng giá khác]
 * ± giá trị (VND / %). Không tích = chỉ hàng này; tích = mọi hàng thuộc bộ lọc hiện tại của cột đó.
 */
export function PriceBookFormulaPopover({ anchor, target, row, books, total, filters, compareBookId, onClose }: Props) {
  const isBase = target.id === BASE_BOOK_ID;
  const [base, setBase] = useState("CURRENT");
  const [op, setOp] = useState<FormulaOp>("PLUS");
  const [value, setValue] = useState("0");
  const [percent, setPercent] = useState(false);
  const [all, setAll] = useState(false);
  const apply = useApplyFormula();
  const t = useT(productsNs);
  const tc = useT(commonNs);
  const positioning = useMemo(() => zoomAwarePositioning(() => anchor), [anchor]);

  const baseValue = (): number | null | undefined => {
    if (base === "CURRENT") return isBase ? row.basePrice : row.prices[target.id];
    if (base === "COST") return row.cost;
    if (base === "LAST_PURCHASE") return row.lastPurchasePrice;
    if (base === "BASE_PRICE") return row.basePrice;
    return row.prices[base.slice(BOOK_PREFIX.length)];
  };
  const from = baseValue();
  const preview = from == null ? null : applyFormula(Number(from), op, Number(value) || 0, percent);

  function submit() {
    const v = Number(value || 0);
    if (!Number.isFinite(v) || v < 0) return toast.error(t("formula.errors.invalidValue"));
    const isBook = base.startsWith(BOOK_PREFIX);
    apply.mutate({
      bookId: target.id,
      body: {
        base: (isBook ? "BOOK" : base) as FormulaBase, baseBookId: isBook ? base.slice(BOOK_PREFIX.length) : null, op, value: v,
        percent, onlyExisting: all && !isBase && filters.inBookOnly, unitIds: all ? null : [row.unitId],
        q: filters.q, code: filters.code, name: filters.name, categoryIds: filters.categoryIds, stock: filters.stock,
        priceOp: filters.priceOp || null, compareWith: filters.compareWith || null, compareBookId,
      },
    }, {
      onSuccess: (r) => { toast.success(t("formula.toastApplied", { count: r.updated, name: target.name })); onClose(); },
      onError: (e) => toast.error(errorMessage(e)),
    });
  }

  return (
    <PopoverPrimitive.Root open onOpenChange={(o) => !o && onClose()}>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner className="isolate z-50 outline-none" {...positioning} side="bottom" align="end" sideOffset={6}>
          <PopoverPrimitive.Popup aria-label={t("formulaPopover.title")}
            className="w-[450px] rounded-lg border bg-popover text-[13px] text-popover-foreground shadow-lg outline-none">
            <div className="space-y-4 p-4">
              <div className="text-sm font-bold">{t("formulaPopover.title")}</div>
              <div className="font-semibold">
                {t("formulaPopover.newPrice")}{" "}
                <span className="text-primary" title={preview == null ? t("formulaPopover.unknownBase") : undefined}>
                  [{preview == null ? "---" : formatMoney(preview)}]
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="shrink-0">{t("formula.newPrice")}</span>
                <select aria-label={t("formula.base")} value={base} onChange={(e) => setBase(e.target.value)}
                  className="h-8 w-40 shrink-0 rounded-md border border-input bg-background px-2 outline-none focus-visible:border-primary">
                  <option value="CURRENT">{t("formulaBase.CURRENT")}</option>
                  <option value="COST">{t("formulaBase.COST")}</option>
                  <option value="LAST_PURCHASE">{t("formulaBase.LAST_PURCHASE")}</option>
                  {!isBase && <option value="BASE_PRICE">{t("formulaBase.BASE_PRICE")}</option>}
                  {books.filter((b) => b.id !== target.id).map((b) => <option key={b.id} value={BOOK_PREFIX + b.id}>{b.name}</option>)}
                </select>
                <div className="min-w-0 flex-1">
                  <FormulaOpValueInputs op={op} onOp={setOp} value={value} onValue={setValue} percent={percent} onPercent={setPercent} />
                </div>
              </div>
              <label className="flex cursor-pointer items-center gap-2">
                <Checkbox checked={all} onCheckedChange={(v) => setAll(v === true)} />
                {t("formulaPopover.applyAll", { count: total, name: target.name })}
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t px-4 py-3">
              <Button variant="outline" className="h-8 rounded-md px-3 font-semibold" onClick={onClose}>{tc("actions.skip")}</Button>
              <Button className="h-8 min-w-14 rounded-md px-3 font-semibold" disabled={apply.isPending} onClick={submit}>{tc("actions.done")}</Button>
            </div>
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
