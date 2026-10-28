"use client";

import { SUB_HEAD, StatusBadge } from "@/features/sales/invoice-list-kit";
import { enumLabel } from "@/features/sales/i18n-enum-label";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { ordersNs } from "@/messages/orders";
import { salesNs } from "@/messages/sales";
import type { Order } from "./order-types";
import { ListEmptyRow } from "@/components/ui/list-empty-state";
import { DocCodeLink } from "@/components/ui/doc-code-link";

/** Khối tổng tiền bên phải chi tiết đơn: tổng tiền hàng, giảm giá, khách cần trả, khách đã trả (đặt cọc). */
export function OrderTotals({ order }: { order: Order }) {
  const t = useT(ordersNs);
  const qty = order.lines.reduce((s, l) => s + Number(l.quantity), 0);
  const rows = [[t("totals.subtotal", { qty: formatNumber(qty) }), order.subtotal], [t("totals.discount"), order.discount],
    [t("totals.total"), order.total]] as const;
  return (
    <div className="w-[260px] shrink-0 space-y-2.5 text-[13px]">
      {rows.map(([k, v]) => <div key={k} className="grid grid-cols-[1fr_100px] gap-4 text-right"><span>{k}</span><span>{formatMoney(v)}</span></div>)}
      <div className="grid grid-cols-[1fr_100px] gap-4 text-right"><span>{t("totals.paid")}</span><b>{formatMoney(order.deposit)}</b></div>
    </div>
  );
}

/** Tab "Lịch sử thanh toán": phiếu thu đặt cọc + phiếu chi hoàn cọc khi hủy đơn. */
export function OrderPaymentHistory({ order }: { order: Order }) {
  const t = useT(ordersNs);
  const ts = useT(salesNs);
  return (
    <div className="p-4">
      <table className="w-full text-[13px]">
        <thead className={SUB_HEAD}><tr><th className="pl-2.5">{t("payments.code")}</th><th>{t("payments.time")}</th>
          <th>{t("payments.createdBy")}</th><th>{t("payments.type")}</th><th>{t("payments.method")}</th><th>{t("payments.status")}</th>
          <th className="pr-2.5 text-right">{t("payments.amount")}</th></tr></thead>
        <tbody>
          {!order.payments.length && <ListEmptyRow cols={7} what={t("payments.emptyWhat")} compact />}
          {order.payments.map((p) => (
            <tr key={p.voucherId} className="border-b border-[#eff0f3] [&_td]:px-2 [&_td]:py-2.5">
              <td><DocCodeLink code={p.code} kind="/cashbook" /></td><td>{formatDateTime(p.occurredAt)}</td><td>{p.createdByName}</td>
              <td>{t(p.voucherType === "RECEIPT" ? "payments.depositReceipt" : "payments.depositRefund")}</td>
              <td>{enumLabel(ts, salesNs, "enums.fund", p.fund)}</td>
              <td><StatusBadge tone={p.status === "PAID" ? "green" : "red"}>{t(p.status === "PAID" ? "payments.paid" : "payments.cancelled")}</StatusBadge></td>
              <td className="text-right">{p.voucherType === "PAYMENT" ? "-" : ""}{formatMoney(p.amount)}</td>
            </tr>))}
        </tbody>
      </table>
    </div>
  );
}
