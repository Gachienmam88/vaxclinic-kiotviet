"use client";

import { DocCodeLink } from "@/components/ui/doc-code-link";
import { SUB_HEAD } from "@/features/sales/invoice-list-kit";
import { formatMoney, formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { ordersNs } from "@/messages/orders";
import { salesNs } from "@/messages/sales";
import type { OrderLine } from "./order-types";

/** Dòng hàng đơn đặt (KiotViet): số lượng đặt, dưới là số đã giao (đỏ, theo hóa đơn còn hiệu lực tạo từ đơn). */
export function OrderLinesTable({ lines }: { lines: OrderLine[] }) {
  const t = useT(salesNs);
  const to = useT(ordersNs);
  return (
    <table className="w-full text-[13px]">
      <thead className={SUB_HEAD}><tr><th className="pl-2.5">{t("invoices.lines.productCode")}</th><th>{t("invoices.lines.productName")}</th>
        <th className="text-right">{t("invoices.lines.quantity")}</th><th className="text-right">{t("invoices.lines.unitPrice")}</th>
        <th className="text-right">{t("invoices.lines.discount")}</th>
        <th className="text-right">{t("invoices.lines.price")}</th><th className="pr-2.5 text-right">{t("invoices.lines.amount")}</th></tr></thead>
      <tbody>{lines.map((l) => (
        <tr key={l.id} className="border-b border-[#eff0f3] align-top [&_td]:px-2 [&_td]:py-2.5">
          <td><DocCodeLink code={l.productCode} kind="/products" /></td>
          <td>{l.productName} ({l.unitName}){l.note && <div className="text-xs text-muted-foreground italic">{l.note}</div>}</td>
          <td className="text-right">{formatNumber(l.quantity)}
            <div className="text-xs text-[#e5202e]" title={to("kv.detail.delivered")}>{formatNumber(l.deliveredQuantity ?? 0)}</div></td>
          <td className="text-right">{formatMoney(l.unitPrice)}</td>
          <td className="text-right">{Number(l.discount) ? formatMoney(l.discount) : ""}</td>
          <td className="text-right">{formatMoney(l.price)}</td><td className="text-right font-bold">{formatMoney(l.amount)}</td>
        </tr>))}</tbody>
    </table>
  );
}
