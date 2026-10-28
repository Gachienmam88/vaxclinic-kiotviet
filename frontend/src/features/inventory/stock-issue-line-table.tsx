"use client";

import { Trash2 } from "lucide-react";
import { DocCodeLink } from "@/components/ui/doc-code-link";
import { NumberInput } from "@/components/number-input";
import { NativeSelect } from "@/features/products/product-form-sections";
import { changeUnit, unitOf, type LineForm } from "@/features/purchases/purchase-line-form";
import { LotSelect } from "@/features/purchases/purchase-line-table";
import { formatMoney } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { inventoryNs } from "@/messages/inventory";
import { ISSUE_CONFIG, type IssueType } from "./inventory-types";
import { issueLineValue } from "./stock-issue-editor-state";

type Props = { type: IssueType; lines: LineForm[]; branchId: string; onChange: (lines: LineForm[]) => void };

const TD = "px-2 py-2";

/** Dòng phiếu xuất: Mã hàng, Tên hàng, ĐVT, Lô/HSD (gồm cả lô hết hạn), SL, Giá vốn (chỉ xem), Giá trị. */
export function StockIssueLineTable({ type, lines, branchId, onChange }: Props) {
  const cfg = ISSUE_CONFIG[type];
  const t = useT(inventoryNs);
  const qtyLabel = t(`issue.${cfg.msg}.qtyLabel`);
  const update = (key: string, patch: Partial<LineForm>) => onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  return (
    <table className="w-full text-[13px]">
      <thead className="sticky top-0 bg-primary-tint text-left text-xs font-bold">
        <tr className="h-[30px]">
          <th className="w-10 px-2" /><th className="w-12 px-2">{t("fields.index")}</th><th className="w-32 px-2">{t("fields.productCode")}</th>
          <th className="px-2">{t("fields.productName")}</th><th className="w-28 px-2">{t("fields.unit")}</th><th className="w-64 px-2">{t("fields.lotExpiry")}</th>
          <th className="w-28 px-2 text-right">{qtyLabel}</th><th className="w-32 px-2 text-right">{t("fields.cost")}</th>
          <th className="w-36 px-2 pr-4 text-right">{t(`issue.${cfg.msg}.lineValueLabel`)}</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((l, i) => (
          <tr key={l.key} className="border-b border-[#e5e7eb] align-top hover:bg-[#f7f8fa]">
            <td className={TD}>
              <button type="button" aria-label={t("editor.removeLine")} className="flex h-8 items-center text-muted-foreground hover:text-destructive"
                onClick={() => onChange(lines.filter((x) => x.key !== l.key))}><Trash2 className="size-4" /></button>
            </td>
            <td className={`${TD} leading-8`}>{i + 1}</td>
            <td className={`${TD} leading-8`}><DocCodeLink code={unitOf(l).code} newTab /></td>
            <td className={`${TD} leading-8`}>{l.productName}</td>
            <td className={TD}>
              <NativeSelect value={l.unitId} disabled={l.units.length < 2} aria-label={t("fields.unitFull")}
                onChange={(e) => onChange(lines.map((x) => (x.key === l.key ? changeUnit(x, e.target.value) : x)))}>
                {l.units.map((u) => <option key={u.id} value={u.id}>{u.unitName}</option>)}
              </NativeSelect>
            </td>
            <td className={TD}>
              {l.lotManaged
                ? <LotSelect line={l} branchId={branchId} onChange={(lotNumber) => update(l.key, { lotNumber })} />
                : <span className="leading-8 text-muted-foreground">—</span>}
            </td>
            <td className={TD}>
              <NumberInput aria-label={qtyLabel} value={l.quantity} onValueChange={(quantity) => update(l.key, { quantity })} />
            </td>
            <td className={`${TD} text-right leading-8`}>{formatMoney(l.unitPrice)}</td>
            <td className={`${TD} pr-4 text-right font-bold leading-8`}>{formatMoney(issueLineValue(l))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
