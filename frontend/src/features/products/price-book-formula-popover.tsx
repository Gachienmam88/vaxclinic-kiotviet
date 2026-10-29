"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/api-client";
import { NativeSelect } from "./product-form-sections";
import { useApplyFormula } from "./price-book-queries";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { productsNs } from "@/messages/products";
import {
  FORMULA_BASES, type FormulaBase, type FormulaOp, type PriceBook, type PriceRowFilters,
} from "./price-book-types";

type Props = { book: PriceBook; books: PriceBook[]; filters: PriceRowFilters; total: number; onClose: () => void };

/**
 * "Áp dụng công thức" trên cột bảng giá: Giá mới = [Giá chung | Giá vốn | Giá nhập cuối | bảng giá khác] ± giá trị (VNĐ / %)
 * cho mọi hàng thuộc bộ lọc hiện tại (không chỉ trang đang xem). Làm tròn VNĐ, không âm.
 */
export function PriceBookFormulaDialog({ book, books, filters, total, onClose }: Props) {
  const [base, setBase] = useState<FormulaBase>("BASE_PRICE");
  const [baseBookId, setBaseBookId] = useState(books.find((b) => b.id !== book.id)?.id ?? "");
  const [op, setOp] = useState<FormulaOp>("PLUS");
  const [value, setValue] = useState("0");
  const [percent, setPercent] = useState(false);
  const [onlyExisting, setOnlyExisting] = useState(filters.inBookOnly);
  const apply = useApplyFormula();
  const t = useT(productsNs);
  const tc = useT(commonNs);

  function submit() {
    const v = Number(value);
    if (!Number.isFinite(v) || v < 0) return toast.error(t("formula.errors.invalidValue"));
    if (base === "BOOK" && !baseBookId) return toast.error(t("formula.errors.pickBaseBook"));
    apply.mutate({
      bookId: book.id,
      body: { base, baseBookId: base === "BOOK" ? baseBookId : null, op, value: v, percent, onlyExisting,
        q: filters.q, categoryIds: filters.categoryIds, stock: filters.stock },
    }, {
      onSuccess: (r) => { toast.success(t("formula.toastApplied", { count: r.updated, name: book.name })); onClose(); },
      onError: (e) => toast.error(errorMessage(e)),
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-lg sm:max-w-[560px]">
        <DialogHeader><DialogTitle className="text-base font-bold">{t("formula.title", { name: book.name })}</DialogTitle></DialogHeader>
        <div className="space-y-3 text-[13px]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{t("formula.newPrice")}</span>
            <div className="w-36"><NativeSelect aria-label={t("formula.base")} value={base} onChange={(e) => setBase(e.target.value as FormulaBase)}>
              {FORMULA_BASES.map((k) => <option key={k} value={k}>{t(`formulaBase.${k}`)}</option>)}
            </NativeSelect></div>
            {base === "BOOK" && (
              <div className="w-40"><NativeSelect aria-label={t("formula.baseBook")} value={baseBookId} onChange={(e) => setBaseBookId(e.target.value)}>
                <option value="">{t("formula.pickBook")}</option>
                {books.filter((b) => b.id !== book.id).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </NativeSelect></div>
            )}
            <div className="w-14"><NativeSelect aria-label={t("formula.operator")} value={op} onChange={(e) => setOp(e.target.value as FormulaOp)}>
              <option value="PLUS">+</option><option value="MINUS">−</option>
            </NativeSelect></div>
            <Input aria-label={t("formula.value")} type="number" min={0} className="h-8 w-28 text-right" value={value}
              onChange={(e) => setValue(e.target.value)} />
            <div className="w-20"><NativeSelect aria-label={t("formula.unit")} value={percent ? "%" : "VND"} onChange={(e) => setPercent(e.target.value === "%")}>
              <option value="VND">VNĐ</option><option value="%">%</option>
            </NativeSelect></div>
          </div>
          <label className="flex items-center gap-2">
            <Checkbox checked={onlyExisting} onCheckedChange={(v) => setOnlyExisting(v === true)} />
            {t("formula.onlyExisting")}
          </label>
          <p className="text-muted-foreground">
            {onlyExisting ? t("formula.scopeExisting") : t("formula.scopeAll", { count: total })}{" "}
            {t("formula.skipNote")}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{tc("actions.skip")}</Button>
          <Button disabled={apply.isPending} onClick={submit}>{tc("actions.apply")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
