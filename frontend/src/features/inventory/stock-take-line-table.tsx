"use client";

import { Trash2 } from "lucide-react";
import { DocCodeLink } from "@/components/ui/doc-code-link";
import { Input } from "@/components/ui/input";
import { formatDate, formatMoney, formatNumber, parseNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { inventoryNs } from "@/messages/inventory";
import { diffOf, tabOf, type TakeRow, type TakeTab } from "./stock-take-editor-state";
import { DatePicker } from "@/components/ui/date-picker";

type Props = { rows: TakeRow[]; tab: TakeTab; onChange: (rows: TakeRow[]) => void };

const TD = "px-2 py-2";

/** Bảng dòng kiểm kho: Mã hàng, Tên hàng (+ lô/HSD), ĐVT, Tồn kho, Thực tế (trống = chưa kiểm), SL lệch, Giá trị lệch. */
export function StockTakeLineTable({ rows, tab, onChange }: Props) {
  const t = useT(inventoryNs);
  const update = (key: string, patch: Partial<TakeRow>) => onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const shown = rows.filter((r) => tab === "all" || tabOf(r) === tab);

  return (
    <table className="w-full text-[13px]">
      <thead className="sticky top-0 bg-primary-tint text-left text-xs font-bold">
        <tr className="h-[30px]">
          <th className="w-10 px-2" /><th className="w-12 px-2">{t("fields.index")}</th><th className="w-32 px-2">{t("fields.productCode")}</th>
          <th className="px-2">{t("fields.productName")}</th><th className="w-20 px-2">{t("fields.unit")}</th><th className="w-24 px-2 text-right">{t("fields.stock")}</th>
          <th className="w-28 px-2 text-right">{t("fields.actual")}</th><th className="w-24 px-2 text-right">{t("fields.diffQty")}</th>
          <th className="w-32 px-2 pr-4 text-right">{t("fields.diffValue")}</th>
        </tr>
      </thead>
      <tbody>
        {shown.map((r) => {
          const diff = diffOf(r);
          return (
            <tr key={r.key} className="border-b border-[#e5e7eb] align-top hover:bg-[#f7f8fa]">
              <td className={TD}>
                <button type="button" aria-label={t("editor.removeLine")} className="flex h-8 items-center text-muted-foreground hover:text-destructive"
                  onClick={() => onChange(rows.filter((x) => x.key !== r.key))}><Trash2 className="size-4" /></button>
              </td>
              <td className={`${TD} leading-8`}>{rows.indexOf(r) + 1}</td>
              <td className={`${TD} leading-8`}><DocCodeLink code={r.productCode} newTab /></td>
              <td className={TD}>
                <div className="leading-8">{r.productName}</div>
                {r.lotManaged && (r.newLot ? (
                  <div className="mt-1 grid max-w-md grid-cols-2 gap-1.5">
                    <Input placeholder={t("fields.lotNumber")} aria-label={t("fields.lotNumber")} value={r.lotNumber} onChange={(e) => update(r.key, { lotNumber: e.target.value })} />
                    <DatePicker title={t("fields.expiryDate")} aria-label={t("fields.expiryDate")} value={r.expiryDate}
                      onChange={(v) => update(r.key, { expiryDate: v })} />
                  </div>
                ) : (
                  <span className="inline-flex h-5 items-center rounded bg-primary-tint-light px-1.5 text-xs text-primary">
                    {t("take.lotBadge", { lot: r.lotNumber, expiry: formatDate(r.expiryDate) })}
                  </span>
                ))}
              </td>
              <td className={`${TD} leading-8`}>{r.unitName}</td>
              <td className={`${TD} text-right leading-8`}>{formatNumber(r.systemQty)}</td>
              <td className={TD}>
                <Input inputMode="decimal" aria-label={t("fields.actual")} className="text-right" placeholder={t("fields.unchecked")}
                  value={r.actual == null ? "" : String(r.actual)}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^\d.,]/g, "");
                    update(r.key, { actual: raw === "" ? null : parseNumber(raw) });
                  }} />
              </td>
              <td className={cn(`${TD} text-right leading-8`, diff > 0 && "text-[#0d9f4f]", diff < 0 && "text-destructive")}>
                {r.actual == null ? "" : formatNumber(diff)}
              </td>
              <td className={`${TD} pr-4 text-right font-bold leading-8`}>{r.actual == null ? "" : formatMoney(Math.round(diff * r.cost))}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
