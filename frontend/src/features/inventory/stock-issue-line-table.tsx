"use client";

import { Trash2 } from "lucide-react";
import { NumberInput } from "@/components/number-input";
import { NativeSelect } from "@/features/products/product-form-sections";
import { changeUnit, unitOf, type LineForm } from "@/features/purchases/purchase-line-form";
import { LotSelect } from "@/features/purchases/purchase-line-table";
import { formatMoney } from "@/lib/format";
import { ISSUE_CONFIG, type IssueType } from "./inventory-types";
import { issueLineValue } from "./stock-issue-editor-state";

type Props = { type: IssueType; lines: LineForm[]; branchId: string; onChange: (lines: LineForm[]) => void };

const TD = "px-2 py-2";

/** Dòng phiếu xuất: Mã hàng, Tên hàng, ĐVT, Lô/HSD (gồm cả lô hết hạn), SL, Giá vốn (chỉ xem), Giá trị. */
export function StockIssueLineTable({ type, lines, branchId, onChange }: Props) {
  const cfg = ISSUE_CONFIG[type];
  const update = (key: string, patch: Partial<LineForm>) => onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  return (
    <table className="w-full text-[13px]">
      <thead className="sticky top-0 bg-[#e3f0fc] text-left text-xs font-bold">
        <tr className="h-[30px]">
          <th className="w-10 px-2" /><th className="w-12 px-2">STT</th><th className="w-32 px-2">Mã hàng</th>
          <th className="px-2">Tên hàng</th><th className="w-28 px-2">ĐVT</th><th className="w-64 px-2">Lô / HSD</th>
          <th className="w-28 px-2 text-right">{cfg.qtyLabel}</th><th className="w-32 px-2 text-right">Giá vốn</th>
          <th className="w-36 px-2 pr-4 text-right">{cfg.lineValueLabel}</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((l, i) => (
          <tr key={l.key} className="border-b border-[#e5e7eb] align-top hover:bg-[#f7f8fa]">
            <td className={TD}>
              <button type="button" aria-label="Xóa dòng" className="flex h-8 items-center text-muted-foreground hover:text-destructive"
                onClick={() => onChange(lines.filter((x) => x.key !== l.key))}><Trash2 className="size-4" /></button>
            </td>
            <td className={`${TD} leading-8`}>{i + 1}</td>
            <td className={`${TD} leading-8 text-primary`}>{unitOf(l).code}</td>
            <td className={`${TD} leading-8`}>{l.productName}</td>
            <td className={TD}>
              <NativeSelect value={l.unitId} disabled={l.units.length < 2} aria-label="Đơn vị tính"
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
              <NumberInput aria-label={cfg.qtyLabel} value={l.quantity} onValueChange={(quantity) => update(l.key, { quantity })} />
            </td>
            <td className={`${TD} text-right leading-8`}>{formatMoney(l.unitPrice)}</td>
            <td className={`${TD} pr-4 text-right font-bold leading-8`}>{formatMoney(issueLineValue(l))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
