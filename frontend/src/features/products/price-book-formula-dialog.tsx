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
import {
  FORMULA_BASE_LABEL, type FormulaBase, type FormulaOp, type PriceBook, type PriceRowFilters,
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

  function submit() {
    const v = Number(value);
    if (!Number.isFinite(v) || v < 0) return toast.error("Giá trị không hợp lệ");
    if (base === "BOOK" && !baseBookId) return toast.error("Chọn bảng giá làm gốc");
    apply.mutate({
      bookId: book.id,
      body: { base, baseBookId: base === "BOOK" ? baseBookId : null, op, value: v, percent, onlyExisting,
        q: filters.q, categoryIds: filters.categoryIds, stock: filters.stock },
    }, {
      onSuccess: (r) => { toast.success(`Đã cập nhật giá ${r.updated} hàng trong "${book.name}"`); onClose(); },
      onError: (e) => toast.error(errorMessage(e)),
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-lg sm:max-w-[560px]">
        <DialogHeader><DialogTitle className="text-base font-bold">Áp dụng công thức — {book.name}</DialogTitle></DialogHeader>
        <div className="space-y-3 text-[13px]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">Giá mới =</span>
            <div className="w-36"><NativeSelect aria-label="Giá gốc" value={base} onChange={(e) => setBase(e.target.value as FormulaBase)}>
              {(Object.keys(FORMULA_BASE_LABEL) as FormulaBase[]).map((k) => <option key={k} value={k}>{FORMULA_BASE_LABEL[k]}</option>)}
            </NativeSelect></div>
            {base === "BOOK" && (
              <div className="w-40"><NativeSelect aria-label="Bảng giá gốc" value={baseBookId} onChange={(e) => setBaseBookId(e.target.value)}>
                <option value="">Chọn bảng giá</option>
                {books.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </NativeSelect></div>
            )}
            <div className="w-14"><NativeSelect aria-label="Phép tính" value={op} onChange={(e) => setOp(e.target.value as FormulaOp)}>
              <option value="PLUS">+</option><option value="MINUS">−</option>
            </NativeSelect></div>
            <Input aria-label="Giá trị" type="number" min={0} className="h-8 w-28 text-right" value={value}
              onChange={(e) => setValue(e.target.value)} />
            <div className="w-20"><NativeSelect aria-label="Đơn vị" value={percent ? "%" : "VND"} onChange={(e) => setPercent(e.target.value === "%")}>
              <option value="VND">VNĐ</option><option value="%">%</option>
            </NativeSelect></div>
          </div>
          <label className="flex items-center gap-2">
            <Checkbox checked={onlyExisting} onCheckedChange={(v) => setOnlyExisting(v === true)} />
            Chỉ áp dụng cho hàng đã có trong bảng giá
          </label>
          <p className="text-muted-foreground">
            Áp dụng cho {onlyExisting ? "các hàng đã có trong bảng giá thuộc" : `${total} hàng thuộc`} bộ lọc hiện tại.
            Hàng chưa có giá gốc (VD chưa từng nhập hàng) sẽ được bỏ qua.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Bỏ qua</Button>
          <Button disabled={apply.isPending} onClick={submit}>Áp dụng</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
