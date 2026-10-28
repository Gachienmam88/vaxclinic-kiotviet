"use client";

import { SUB_HEAD, StatusBadge } from "@/features/sales/invoice-list-kit";
import { FUND_LABEL } from "@/features/sales/sales-types";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import type { Order } from "./order-types";
import { ListEmptyRow } from "@/components/ui/list-empty-state";
import { DocCodeLink } from "@/components/ui/doc-code-link";

/** Khối tổng tiền bên phải chi tiết đơn: tổng tiền hàng, giảm giá, khách cần trả, khách đã trả (đặt cọc). */
export function OrderTotals({ order }: { order: Order }) {
  const qty = order.lines.reduce((s, l) => s + Number(l.quantity), 0);
  const rows = [[`Tổng tiền hàng (${formatNumber(qty)})`, order.subtotal], ["Giảm giá phiếu đặt", order.discount],
    ["Khách cần trả", order.total]] as const;
  return (
    <div className="w-[260px] shrink-0 space-y-2.5 text-[13px]">
      {rows.map(([k, v]) => <div key={k} className="grid grid-cols-[1fr_100px] gap-4 text-right"><span>{k}</span><span>{formatMoney(v)}</span></div>)}
      <div className="grid grid-cols-[1fr_100px] gap-4 text-right"><span>Khách đã trả</span><b>{formatMoney(order.deposit)}</b></div>
    </div>
  );
}

/** Tab "Lịch sử thanh toán": phiếu thu đặt cọc + phiếu chi hoàn cọc khi hủy đơn. */
export function OrderPaymentHistory({ order }: { order: Order }) {
  return (
    <div className="p-4">
      <table className="w-full text-[13px]">
        <thead className={SUB_HEAD}><tr><th className="pl-2.5">Mã phiếu</th><th>Thời gian</th><th>Người tạo</th>
          <th>Loại phiếu</th><th>Phương thức</th><th>Trạng thái</th><th className="pr-2.5 text-right">Tiền thu/chi</th></tr></thead>
        <tbody>
          {!order.payments.length && <ListEmptyRow cols={7} what="phiếu thanh toán" compact />}
          {order.payments.map((p) => (
            <tr key={p.voucherId} className="border-b border-[#eff0f3] [&_td]:px-2 [&_td]:py-2.5">
              <td><DocCodeLink code={p.code} kind="/cashbook" /></td><td>{formatDateTime(p.occurredAt)}</td><td>{p.createdByName}</td>
              <td>{p.voucherType === "RECEIPT" ? "Phiếu thu đặt cọc" : "Phiếu chi hoàn cọc"}</td><td>{FUND_LABEL[p.fund]}</td>
              <td><StatusBadge tone={p.status === "PAID" ? "green" : "red"}>{p.status === "PAID" ? "Đã thanh toán" : "Đã hủy"}</StatusBadge></td>
              <td className="text-right">{p.voucherType === "PAYMENT" ? "-" : ""}{formatMoney(p.amount)}</td>
            </tr>))}
        </tbody>
      </table>
    </div>
  );
}
