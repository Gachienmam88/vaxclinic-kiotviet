"use client";

import { Trash2 } from "lucide-react";
import { DocCodeLink } from "@/components/ui/doc-code-link";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/number-input";
import { NativeSelect } from "@/features/products/product-form-sections";
import { useProductLots } from "@/features/products/product-queries";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { lineAmount } from "./purchase-math";
import { changeUnit, type LineForm } from "./purchase-line-form";
import { DatePicker } from "@/components/ui/date-picker";
import { useT } from "@/lib/i18n";
import { purchasesNs } from "@/messages/purchases";

type Props = {
  mode: "receipt" | "return";
  lines: LineForm[];
  branchId: string;
  onChange: (lines: LineForm[]) => void;
  readOnly?: boolean;
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

export function PurchaseLineTable({ mode, lines, branchId, onChange, readOnly }: Props) {
  const update = (key: string, patch: Partial<LineForm>) =>
    onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const isReceipt = mode === "receipt";
  const t = useT(purchasesNs);

  return (
    <table className="w-full text-[13px]">
      <thead className="sticky top-0 bg-primary-tint text-left text-xs font-bold">
        <tr className="h-[30px]">
          <th className="w-10 px-2" /><th className="w-12 px-2">{t("lines.index")}</th><th className="w-32 px-2">{t("lines.productCode")}</th>
          <th className="px-2">{t("lines.productName")}</th><th className="w-28 px-2">{t("lines.unit")}</th>
          <th className="w-28 px-2 text-right">{t("lines.quantity")}</th>
          <th className="w-36 px-2 text-right">{isReceipt ? t("lines.unitPrice") : t("lines.returnPrice")}</th>
          {isReceipt && <th className="w-32 px-2 text-right">{t("lines.discount")}</th>}
          <th className="w-36 px-2 pr-4 text-right">{t("lines.amount")}</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((l, i) => {
          const unit = l.units.find((u) => u.id === l.unitId) ?? l.units[0];
          return (
            <tr key={l.key} className="border-b border-[#e5e7eb] align-top hover:bg-[#f7f8fa]">
              <td className="px-2 py-2">
                {!readOnly && (
                  <button type="button" aria-label={t("lines.removeLine")} className="flex h-8 items-center text-muted-foreground hover:text-destructive"
                    onClick={() => onChange(lines.filter((x) => x.key !== l.key))}><Trash2 className="size-4" /></button>
                )}
              </td>
              <td className="px-2 py-2 leading-8">{i + 1}</td>
              <td className="px-2 py-2 leading-8"><DocCodeLink code={unit.code} newTab /></td>
              <td className="px-2 py-2">
                <div className="leading-8">{l.productName}</div>
                {l.lotManaged && (
                  <div className="mt-1 grid max-w-md grid-cols-2 gap-1.5">
                    {isReceipt ? (
                      <>
                        <Input placeholder={t("lines.lotNumber")} value={l.lotNumber} disabled={readOnly}
                          onChange={(e) => update(l.key, { lotNumber: e.target.value })} />
                        <DatePicker title={t("lines.expiry")} value={l.expiryDate} disabled={readOnly}
                          onChange={(v) => update(l.key, { expiryDate: v })} />
                      </>
                    ) : (
                      <div className="col-span-2">
                        <LotSelect line={l} branchId={branchId} disabled={readOnly}
                          onChange={(lotNumber) => update(l.key, { lotNumber })} />
                      </div>
                    )}
                  </div>
                )}
              </td>
              <td className="px-2 py-2">
                <NativeSelect value={l.unitId} disabled={readOnly || l.units.length < 2}
                  onChange={(e) => onChange(lines.map((x) => (x.key === l.key ? changeUnit(x, e.target.value) : x)))}>
                  {l.units.map((u) => <option key={u.id} value={u.id}>{u.unitName}</option>)}
                </NativeSelect>
              </td>
              <td className="px-2 py-2">
                <NumberInput value={l.quantity} disabled={readOnly} onValueChange={(quantity) => update(l.key, { quantity })} />
              </td>
              <td className="px-2 py-2">
                <NumberInput value={l.unitPrice} disabled={readOnly} onValueChange={(unitPrice) => update(l.key, { unitPrice })} />
              </td>
              {isReceipt && (
                <td className="px-2 py-2">
                  <NumberInput value={l.discount} disabled={readOnly} onValueChange={(discount) => update(l.key, { discount })} />
                </td>
              )}
              <td className="px-2 py-2 pr-4 text-right font-bold leading-8">{formatMoney(lineAmount(l))}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
