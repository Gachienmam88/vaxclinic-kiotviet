"use client";

import Link from "next/link";
import { Pencil, Tag, Trash2 } from "lucide-react";
import { DocCodeLink } from "@/components/ui/doc-code-link";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/number-input";
import { NativeSelect } from "@/features/products/product-form-sections";
import { useProductLots } from "@/features/products/product-queries";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { lineAmount, priceWithVat } from "./purchase-math";
import { changeUnit, type LineForm } from "./purchase-line-form";
import type { EditorOptions } from "./purchase-editor-options";
import { DatePicker } from "@/components/ui/date-picker";
import { useT } from "@/lib/i18n";
import { purchasesNs } from "@/messages/purchases";

export const VAT_CHOICES: (number | null)[] = [null, 0, 5, 8, 10];

type Props = {
  mode: "receipt" | "return";
  lines: LineForm[];
  branchId: string;
  onChange: (lines: LineForm[]) => void;
  readOnly?: boolean;
  /** Sửa phiếu đã nhập: không xóa dòng, không đổi đơn vị / lô (chỉ SL, giá, giảm giá, VAT, ghi chú). */
  lockStructure?: boolean;
  vatOn?: boolean;
  opts?: EditorOptions;
};

/** Phiếu trả / xuất hủy / xuất nội bộ: chọn lô đang tồn tại chi nhánh (FEFO, kể cả lô hết hạn; hiển thị tồn từng lô). */
export function LotSelect({ line, branchId, onChange, disabled }: {
  line: LineForm; branchId: string; onChange: (lot: string) => void; disabled?: boolean;
}) {
  const t = useT(purchasesNs);
  const { data: lots = [] } = useProductLots(line.productId, true);
  const here = lots.filter((l) => l.branchId === branchId);
  return (
    <NativeSelect value={line.lotNumber} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      <option value="">{t("lines.pickLot")}</option>
      {here.map((l) => (
        <option key={l.id} value={l.lotNumber}>{t("lines.lotOption", { lot: l.lotNumber, expiry: formatDate(l.expiryDate), qty: formatNumber(l.quantity) })}</option>
      ))}
    </NativeSelect>
  );
}

const TD = "px-2 py-2 align-top";
const NUM = "h-[26px] rounded-md text-[13px]";

/**
 * Bảng dòng màn nhập hàng / trả hàng nhập kiểu KiotViet (ảnh 287, 307): STT, Mã hàng, Tên hàng + "Ghi chú… ✎", ĐVT,
 * Số lượng (trả theo phiếu: "/N" còn trả được), [Giá nhập], Đơn giá / Giá trả lại, Giảm giá, VAT (%), Giá có VAT, Thành tiền.
 * Ô số lượng có data-qty để phím Enter / Shift / ↑ / ↓ điều hướng (purchase-editor-shortcuts).
 */
export function PurchaseLineTable({ mode, lines, branchId, onChange, readOnly, lockStructure, vatOn = true, opts }: Props) {
  const update = (key: string, patch: Partial<LineForm>) => onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const isReceipt = mode === "receipt";
  const t = useT(purchasesNs);
  const show = (c: string) => !opts?.hidden.includes(c as never);
  const pct = isReceipt && !!opts?.discountPercent;
  const byReceipt = lines.some((l) => l.purchasePrice != null);

  return (
    <table className="w-full min-w-[980px] text-[13px]">
      <thead className="sticky top-0 z-10 bg-primary-tint text-left text-xs font-bold">
        <tr className="h-[30px]">
          <th className="w-9 px-2" /><th className="w-12 px-2">{t("lines.index")}</th>
          {show("code") && <th className="w-28 px-2">{t("lines.productCode")}</th>}
          <th className="px-2">{t("lines.productName")}</th>
          {show("unit") && <th className="w-24 px-2">{t("lines.unit")}</th>}
          <th className="w-28 px-2 text-right">{t("lines.quantity")}</th>
          {byReceipt && <th className="w-28 px-2 text-right">{t("kv.purchasePrice")}</th>}
          <th className="w-32 px-2 text-right">{isReceipt ? t("lines.unitPrice") : t("lines.returnPrice")}</th>
          {isReceipt && show("discount") && <th className="w-28 px-2 text-right">{t("lines.discount")}{pct && " (%)"}</th>}
          {vatOn && show("vat") && <th className="w-24 px-2">VAT (%)</th>}
          {show("priceWithVat") && <th className="w-32 px-2 text-right">{isReceipt ? t("kv.priceWithVat") : t("kv.returnPriceWithVat")}</th>}
          {show("amount") && <th className="w-32 px-2 pr-4 text-right">{t("lines.amount")}</th>}
        </tr>
      </thead>
      <tbody>
        {lines.map((l, i) => {
          const unit = l.units.find((u) => u.id === l.unitId) ?? l.units[0];
          const amount = lineAmount(l);
          return (
            <tr key={l.key} className="border-b border-[#e5e7eb] hover:bg-[#f7f8fa]">
              <td className={TD}>
                {!readOnly && !lockStructure && (
                  <button type="button" aria-label={t("lines.removeLine")} className="flex h-[26px] items-center text-muted-foreground hover:text-destructive"
                    onClick={() => onChange(lines.filter((x) => x.key !== l.key))}><Trash2 className="size-4" /></button>
                )}
              </td>
              <td className={`${TD} leading-[26px]`}>{i + 1}</td>
              {show("code") && <td className={`${TD} leading-[26px]`}><DocCodeLink code={unit.code} newTab /></td>}
              <td className={TD}>
                <div className="leading-[26px]">{l.productName}</div>
                <NoteEditor value={l.note ?? ""} disabled={readOnly} onChange={(note) => update(l.key, { note })} />
                {isReceipt && opts?.priceSetup && (
                  <Link href={`/products/price-books?code=${encodeURIComponent(unit.code)}`} target="_blank" prefetch={false}
                    className="inline-flex items-center gap-1 text-xs text-[#2171bc] hover:text-[#1a9dcc]"><Tag className="size-3" /> {t("detail.priceSetup")}</Link>
                )}
                {l.lotManaged && (
                  <div className="mt-1 grid max-w-md grid-cols-2 gap-1.5">
                    {isReceipt ? (
                      <>
                        <Input placeholder={t("lines.lotNumber")} value={l.lotNumber} disabled={readOnly || lockStructure}
                          onChange={(e) => update(l.key, { lotNumber: e.target.value })} />
                        <DatePicker title={t("lines.expiry")} value={l.expiryDate} disabled={readOnly || lockStructure}
                          onChange={(v) => update(l.key, { expiryDate: v })} />
                      </>
                    ) : byReceipt ? <span className="col-span-2 text-xs text-muted-foreground">{t("lines.lotNumber")}: {l.lotNumber}</span> : (
                      <div className="col-span-2">
                        <LotSelect line={l} branchId={branchId} disabled={readOnly} onChange={(lotNumber) => update(l.key, { lotNumber })} />
                      </div>
                    )}
                  </div>
                )}
              </td>
              {show("unit") && (
                <td className={TD}>
                  {readOnly || lockStructure || byReceipt || l.units.length < 2
                    ? <span className="leading-[26px] text-primary">{unit.unitName}</span>
                    : <NativeSelect value={l.unitId} onChange={(e) => onChange(lines.map((x) => (x.key === l.key ? changeUnit(x, e.target.value) : x)))}>
                      {l.units.map((u) => <option key={u.id} value={u.id}>{u.unitName}</option>)}
                    </NativeSelect>}
                </td>
              )}
              <td className={TD}>
                <NumberInput data-qty={i} aria-label={t("lines.quantity")} className={NUM} value={l.quantity} disabled={readOnly}
                  onValueChange={(quantity) => update(l.key, { quantity: l.maxQty != null ? Math.min(quantity, l.maxQty) : quantity })} />
                {l.maxQty != null && <div className="mt-0.5 text-right text-xs text-muted-foreground">/{formatNumber(l.maxQty)}</div>}
              </td>
              {byReceipt && <td className={`${TD} text-right leading-[26px]`}>{formatNumber(l.purchasePrice ?? 0)}</td>}
              <td className={TD}>
                <NumberInput aria-label={isReceipt ? t("lines.unitPrice") : t("lines.returnPrice")} className={NUM} value={l.unitPrice} disabled={readOnly}
                  onValueChange={(unitPrice) => update(l.key, { unitPrice })} />
              </td>
              {isReceipt && show("discount") && (
                <td className={TD}>
                  <NumberInput aria-label={t("lines.discount")} className={NUM} disabled={readOnly}
                    value={pct ? (l.unitPrice ? Math.round((l.discount / l.unitPrice) * 10000) / 100 : 0) : l.discount}
                    onValueChange={(v) => update(l.key, { discount: pct ? Math.round((l.unitPrice * Math.min(v, 100)) / 100) : v })} />
                </td>
              )}
              {vatOn && show("vat") && (
                <td className={TD}>
                  <select aria-label="VAT (%)" disabled={readOnly} value={l.vatRate == null ? "" : String(l.vatRate)}
                    onChange={(e) => update(l.key, { vatRate: e.target.value === "" ? null : Number(e.target.value) })}
                    className="h-[26px] w-full rounded-md border border-[#d1d5db] bg-background px-1.5 text-xs outline-none focus-visible:border-primary">
                    {VAT_CHOICES.map((v) => <option key={String(v)} value={v == null ? "" : v}>{v == null ? "KCT" : `${v}%`}</option>)}
                  </select>
                </td>
              )}
              {show("priceWithVat") && (
                <td className={`${TD} text-right leading-[26px]`}>{formatNumber(priceWithVat(l.unitPrice, l.discount, vatOn ? l.vatRate ?? null : null))}</td>
              )}
              {show("amount") && (
                <td className={`${TD} pr-4 text-right font-bold`}>
                  {opts?.editAmount && !readOnly && l.quantity > 0
                    ? <NumberInput aria-label={t("lines.amount")} className={NUM} value={Math.round(amount)}
                      onValueChange={(v) => update(l.key, { unitPrice: Math.round((v / l.quantity + l.discount) * 100) / 100 })} />
                    : <span className="leading-[26px]">{formatMoney(amount)}</span>}
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** "Ghi chú… ✎" dưới tên hàng: bấm để nhập ghi chú dòng. */
function NoteEditor({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const t = useT(purchasesNs);
  return (
    <label className="group flex items-center gap-1 text-xs text-muted-foreground">
      <input aria-label={t("kv.lineNote")} disabled={disabled} value={value} placeholder={t("kv.lineNotePlaceholder")}
        onChange={(e) => onChange(e.target.value)}
        className="w-full max-w-[220px] border-0 border-b border-transparent bg-transparent p-0 text-xs outline-none placeholder:text-muted-foreground focus:border-primary" />
      <Pencil className="size-3 shrink-0" />
    </label>
  );
}
