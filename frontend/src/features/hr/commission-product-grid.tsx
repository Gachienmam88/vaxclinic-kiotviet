"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import type { ProductListItem } from "@/features/products/product-types";
import { api } from "@/lib/api-client";
import { formatMoney, parseNumber } from "@/lib/format";
import { useHrMutation } from "./hr-queries";
import type { CommissionTable } from "./hr-types";
import { CommissionRateCell, type Rate } from "./commission-rate-cell";
import { DocCodeLink } from "@/components/ui/doc-code-link";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { hrNs } from "@/messages/hr";

type RuleItem = { productId: string; rateType: "PERCENT" | "AMOUNT"; value: number | null };
const filterBox = "h-7 w-full border-0 border-b border-[#d9dbe0] bg-transparent px-0.5 text-[12px] outline-none placeholder:text-muted-foreground focus:border-primary";

/** Áp 1 mức hoa hồng cho mọi mặt hàng đang hiển thị (VD toàn bộ nhóm hàng đang lọc). */
function ApplyAll({ table, products, onApply }: { table: CommissionTable; products: ProductListItem[]; onApply: (items: RuleItem[]) => void }) {
  const t = useT(hrNs);
  const tc = useT(commonNs);
  const [open, setOpen] = useState(false);
  const [v, setV] = useState("");
  const [type, setType] = useState<"PERCENT" | "AMOUNT">("PERCENT");
  if (!open) {
    return <button type="button" className="text-[11px] font-normal text-primary hover:underline" disabled={!products.length}
      onClick={() => setOpen(true)}>{t("commissionGrid.applyAll")}</button>;
  }
  return (
    <div className="flex items-center justify-end gap-1 font-normal">
      <input aria-label={t("commissionGrid.commonRate", { name: table.name })} autoFocus className="h-6 w-16 rounded border px-1 text-right" value={v}
        onChange={(e) => setV(e.target.value.replace(/[^\d.,]/g, ""))} />
      <select aria-label={t("commissionGrid.unit")} className="h-6 rounded border text-[11px]" value={type} onChange={(e) => setType(e.target.value as "PERCENT" | "AMOUNT")}>
        <option value="PERCENT">%</option><option value="AMOUNT">VNĐ</option>
      </select>
      <button type="button" className="rounded bg-primary px-1.5 py-0.5 text-[11px] text-white" onClick={() => {
        onApply(products.map((p) => ({ productId: p.id, rateType: type, value: v.trim() ? parseNumber(v) : null })));
        setOpen(false);
      }}>{tc("actions.apply")}</button>
      <button type="button" className="text-[11px] text-muted-foreground" onClick={() => setOpen(false)}>{tc("actions.cancel")}</button>
    </div>
  );
}

/** Bảng Hàng hóa × bảng hoa hồng (ảnh 115): mỗi bảng hoa hồng được chọn là 1 cột sửa trực tiếp. */
export function CommissionProductGrid({ products, tables, rates, codeQ, nameQ, onCodeQ, onNameQ, checked, onChecked }: {
  products: ProductListItem[]; tables: CommissionTable[]; rates: Map<string, Rate>;
  codeQ: string; nameQ: string; onCodeQ: (v: string) => void; onNameQ: (v: string) => void;
  checked: string[]; onChecked: (ids: string[]) => void;
}) {
  const t = useT(hrNs);
  const save = useHrMutation(({ tableId, items }: { tableId: string; items: RuleItem[] }) =>
    api(`/hr/commission-tables/${tableId}/rules`, { method: "PUT", body: { items } }), t("commissionGrid.toastSaved"));
  const th = "h-[34px] px-2 text-[12px] font-semibold whitespace-nowrap";
  const allChecked = products.length > 0 && products.every((p) => checked.includes(p.id));
  return (
    <div className="overflow-x-auto rounded-lg bg-white p-2.5">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="bg-primary-tint text-left">
            <th className={`${th} w-8`}>
              <input type="checkbox" aria-label={t("commissionGrid.selectAll")} className="size-4 accent-primary" checked={allChecked}
                onChange={(e) => onChecked(e.target.checked ? products.map((p) => p.id) : [])} />
            </th>
            <th className={th}>{t("commissionGrid.productCode")}</th><th className={th}>{t("commissionGrid.productName")}</th><th className={`${th} text-right`}>{t("commissionGrid.unitName")}</th>
            <th className={`${th} text-right`}>{t("commissionGrid.price")}</th><th className={`${th} text-right`}>{t("commissionGrid.cost")}</th>
            <th className={`${th} text-right`}>
              <span className="inline-flex items-center gap-1">{t("commissionGrid.profit")}
                <span title={t("commissionGrid.profitHint")}><Info className="size-3.5 text-muted-foreground" /></span></span>
            </th>
            {tables.map((tb) => (
              <th key={tb.id} className={`${th} min-w-[150px] text-right`}>
                <div>{tb.name}</div><ApplyAll table={tb} products={products} onApply={(items) => save.mutate({ tableId: tb.id, items })} />
              </th>
            ))}
          </tr>
          <tr className="border-b border-primary/40">
            <th /><th className="px-2 pb-1"><input aria-label={t("commissionGrid.searchCode")} placeholder={t("commissionGrid.searchCode")} className={filterBox}
              value={codeQ} onChange={(e) => onCodeQ(e.target.value)} /></th>
            <th className="px-2 pb-1"><input aria-label={t("commissionGrid.searchName")} placeholder={t("commissionGrid.searchName")} className={filterBox}
              value={nameQ} onChange={(e) => onNameQ(e.target.value)} /></th>
            <th colSpan={4 + tables.length} />
          </tr>
        </thead>
        <tbody>
          {!products.length && <tr><td colSpan={7 + tables.length} className="border-b py-3 text-center text-[12px] text-muted-foreground">
            {t("commissionGrid.noResults")}</td></tr>}
          {products.map((p) => (
            <tr key={p.id} className="border-b border-[#eceef1] hover:bg-[#f3f6fa] [&_td]:px-2 [&_td]:py-2">
              <td><input type="checkbox" aria-label={t("commissionGrid.selectAria", { code: p.code })} className="size-4 accent-primary" checked={checked.includes(p.id)}
                onChange={(e) => onChecked(e.target.checked ? [...checked, p.id] : checked.filter((x) => x !== p.id))} /></td>
              <td><DocCodeLink code={p.code} /></td><td>{p.name}</td><td className="text-right">{p.unitName}</td>
              <td className="text-right">{formatMoney(p.price)}</td><td className="text-right">{formatMoney(p.cost)}</td>
              <td className="text-right">{formatMoney(p.price - p.cost)}</td>
              {tables.map((tb) => {
                const r = rates.get(`${tb.id}|${p.id}`) ?? null;
                return (
                  <td key={tb.id}>
                    <CommissionRateCell key={`${r?.rateType}-${r?.value}`} rate={r} label={`${tb.name} - ${p.code}`}
                      onSave={(n) => save.mutate({ tableId: tb.id, items: [{ productId: p.id, rateType: n?.rateType ?? "PERCENT", value: n?.value ?? null }] })} />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
