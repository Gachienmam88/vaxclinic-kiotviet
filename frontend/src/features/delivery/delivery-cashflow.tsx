"use client";

import { DocCodeLink } from "@/components/ui/doc-code-link";
import { formatMoney } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { deliveryNs } from "@/messages/delivery";
import type { Cashflow } from "./delivery-types";

/**
 * Quản lý giao hàng → Dòng tiền: theo sổ công nợ đối tác trong kỳ — thu hộ đối tác đã thu, phí giao hàng phát sinh, đã đối soát /
 * thanh toán (ròng, trừ phiếu hủy) và số còn lại hiện tại (> 0: đối tác còn nợ cửa hàng).
 */
export function DeliveryCashflow({ data }: { data: Cashflow | undefined }) {
  const t = useT(deliveryNs);
  const head = ["cashCod", "cashFee", "cashSettled", "cashBalance"] as const;
  const money = (n: number, sign = false) => <span className={cn(sign && n < 0 && "text-destructive")}>{formatMoney(n)}</span>;
  return (
    <div className="rounded-lg bg-background">
      <div className="flex h-12 items-center border-b px-4 text-[14px] font-semibold">{t("kv.dash.cashTitle")}</div>
      <p className="px-4 pt-3 text-xs text-muted-foreground">{t("kv.dash.cashHint")}</p>
      <div className="overflow-x-auto p-4">
        <table className="w-full text-[13px]">
          <thead className="bg-[#e8f1fd] text-xs font-semibold [&_th]:h-9 [&_th]:px-3"><tr>
            <th className="text-left">{t("kv.dash.cashPartner")}</th>{head.map((h) => <th key={h} className="text-right">{t(`kv.dash.${h}`)}</th>)}</tr></thead>
          <tbody>
            <tr className="border-b font-bold [&_td]:h-9 [&_td]:px-3"><td />
              <td className="text-right">{money(data?.codCollected ?? 0)}</td><td className="text-right">{money(data?.feeCharged ?? 0)}</td>
              <td className="text-right">{money(data?.settled ?? 0, true)}</td><td className="text-right">{money(data?.balance ?? 0, true)}</td></tr>
            {data?.rows.map((r) => (
              <tr key={r.partnerId} className="border-b [&_td]:h-9 [&_td]:px-3">
                <td><DocCodeLink code={r.partnerCode} kind="/delivery/partners" /> {r.partnerName}</td>
                <td className="text-right">{money(r.codCollected)}</td><td className="text-right">{money(r.feeCharged)}</td>
                <td className="text-right">{money(r.settled, true)}</td><td className="text-right">{money(r.balance, true)}</td>
              </tr>))}
            {data && !data.rows.length && <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">{t("kv.partners.empty")}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
