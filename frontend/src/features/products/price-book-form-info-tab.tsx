"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Info } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Input } from "@/components/ui/input";
import { FormulaOpValueInputs } from "./price-book-formula-inputs";
import type { PriceBook, PriceBookRequest } from "./price-book-types";
import { useT } from "@/lib/i18n";
import { productsNs } from "@/messages/products";

const BOOK_PREFIX = "BOOK:";
const RADIO = "size-4 accent-primary";

/** Thẻ thu gọn được (Hiệu lực / Công thức giá / Khi thu ngân lên đơn...). */
function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="rounded-lg border border-[#e5e7eb] text-[13px]">
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start justify-between gap-2 px-3 pt-3 pb-2 text-left">
        <span><span className="block font-bold">{title}</span>{hint && <span className="block text-xs text-muted-foreground">{hint}</span>}</span>
        {open ? <ChevronUp className="mt-0.5 size-4 shrink-0" /> : <ChevronDown className="mt-0.5 size-4 shrink-0" />}
      </button>
      {open && <div className="space-y-3 px-3 pb-3">{children}</div>}
    </section>
  );
}

type Props = {
  form: PriceBookRequest;
  set: (patch: Partial<PriceBookRequest>) => void;
  /** Giá trị công thức dạng chuỗi đang gõ. */
  valueText: string;
  onValueText: (v: string) => void;
  books: PriceBook[];
  selfId?: string;
};

/** Tab "Thông tin" của Tạo / Sửa bảng giá: tên, hiệu lực + trạng thái, công thức giá, chính sách hàng ngoài bảng giá. */
export function PriceBookFormInfoTab({ form, set, valueText, onValueText, books, selfId }: Props) {
  const t = useT(productsNs);
  const baseValue = form.autoBase == null ? "" : form.autoBase === "BOOK" ? BOOK_PREFIX + (form.autoBaseBookId ?? "") : form.autoBase;
  const allowMissing = form.missingPolicy !== "BLOCK";

  function pickBase(v: string) {
    if (!v) return set({ autoBase: null, autoBaseBookId: null });
    if (v.startsWith(BOOK_PREFIX)) return set({ autoBase: "BOOK", autoBaseBookId: v.slice(BOOK_PREFIX.length) });
    set({ autoBase: v as "BASE_PRICE" | "COST" | "LAST_PURCHASE", autoBaseBookId: null });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-1.5">
        <label htmlFor="pb-name" className="text-xs">{t("bookForm.name")}</label>
        <Input id="pb-name" autoFocus placeholder={t("bookForm.namePlaceholder")} value={form.name} onChange={(e) => set({ name: e.target.value })}
          className="h-8 rounded-md border-primary" />
      </div>
      <Card title={t("bookForm.validity")}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-20 shrink-0">{t("bookForm.validity")}</span>
          <DateTimePicker className="w-[170px]" value={form.validFrom} aria-label={t("bookForm.validFrom")}
            onChange={(v) => v && set({ validFrom: new Date(v).toISOString() })} />
          <span>{t("bookForm.validityTo")}</span>
          <DateTimePicker className="w-[170px]" value={form.validTo} aria-label={t("bookForm.validTo")}
            onChange={(v) => v && set({ validTo: new Date(v).toISOString() })} />
        </div>
        <div className="flex items-center gap-2">
          <span className="w-20 shrink-0">{t("bookForm.statusLabel")}</span>
          {[true, false].map((on) => (
            <label key={String(on)} className="mr-4 flex cursor-pointer items-center gap-1.5">
              <input type="radio" name="pb-active" className={RADIO} checked={form.active === on} onChange={() => set({ active: on })} />
              {on ? t("bookForm.applied") : t("bookForm.notApplied")}
            </label>
          ))}
        </div>
      </Card>
      <Card title={t("bookForm.formulaTitle")} hint={t("bookForm.formulaHint")}>
        <div className="flex items-center gap-2">
          <span className="shrink-0">{t("formula.newPrice")}</span>
          <select aria-label={t("formula.base")} value={baseValue} onChange={(e) => pickBase(e.target.value)}
            className="h-8 w-[220px] shrink-0 rounded-md border border-input bg-background px-2 outline-none focus-visible:border-primary">
            <option value="">{t("bookForm.pickBase")}</option>
            <option value="COST">{t("formulaBase.COST")}</option>
            <option value="LAST_PURCHASE">{t("formulaBase.LAST_PURCHASE")}</option>
            <option value="BASE_PRICE">{t("formulaBase.BASE_PRICE")}</option>
            {books.filter((b) => b.id !== selfId).map((b) => <option key={b.id} value={BOOK_PREFIX + b.id}>{b.name}</option>)}
          </select>
          <div className="w-[230px]">
            <FormulaOpValueInputs op={form.autoOp} onOp={(autoOp) => set({ autoOp })} value={valueText} onValue={onValueText}
              percent={form.autoPercent} onPercent={(autoPercent) => set({ autoPercent })} disabled={form.autoBase == null} />
          </div>
        </div>
      </Card>
      <Card title={t("bookForm.cashierTitle")}>
        <label className="flex cursor-pointer items-center gap-2">
          <input type="radio" name="pb-missing" className={RADIO} checked={allowMissing} onChange={() => set({ missingPolicy: "ALLOW" })} />
          {t("bookForm.allowMissing")}
        </label>
        <label className="ml-6 flex cursor-pointer items-center gap-2">
          <Checkbox checked={form.missingPolicy === "WARN"} disabled={!allowMissing}
            onCheckedChange={(v) => set({ missingPolicy: v === true ? "WARN" : "ALLOW" })} />
          {t("bookForm.warnMissing")}
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <input type="radio" name="pb-missing" className={RADIO} checked={!allowMissing} onChange={() => set({ missingPolicy: "BLOCK" })} />
          {t("bookForm.blockMissing")}
          <span title={t("bookForm.blockMissingHint")} aria-label={t("bookForm.blockMissingHint")}>
            <Info className="size-3.5 text-muted-foreground" />
          </span>
        </label>
      </Card>
    </div>
  );
}
