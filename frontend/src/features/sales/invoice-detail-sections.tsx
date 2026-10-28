"use client";

import { formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { SUB_HEAD, StatusBadge } from "./invoice-list-kit";
import type { Invoice, InvoiceLine } from "./sales-types";
import { FUND_LABEL } from "./sales-types";
import { ListEmptyRow } from "@/components/ui/list-empty-state";
import { DocCodeLink } from "@/components/ui/doc-code-link";

type LineLike = Pick<InvoiceLine, "id" | "productCode" | "productName" | "unitName" | "quantity" | "unitPrice" | "discount"
  | "price" | "amount" | "note"> & { lots?: string | null };

/** Bảng hàng hóa trong chi tiết hóa đơn / đơn đặt hàng (header xám #eff0f3, mã hàng xanh, thành tiền đậm). */
export function InvoiceLinesTable({ inv }: { inv: { lines: LineLike[] } }) {
  return (
    <table className="w-full text-[13px]">
      <thead className={SUB_HEAD}><tr><th className="pl-2.5">Mã hàng</th><th>Tên hàng</th>
        <th className="text-right">Số lượng</th><th className="text-right">Đơn giá</th><th className="text-right">Giảm giá</th>
        <th className="text-right">Giá bán</th><th className="pr-2.5 text-right">Thành tiền</th></tr></thead>
      <tbody>{inv.lines.map((l) => (
        <tr key={l.id} className="border-b border-[#eff0f3] align-top [&_td]:px-2 [&_td]:py-2.5">
          <td><DocCodeLink code={l.productCode} kind="/products" /></td>
          <td>{l.productName} ({l.unitName}){l.lots && <div className="text-xs text-muted-foreground">Lô: {l.lots}</div>}
            {l.note && <div className="text-xs text-muted-foreground italic">{l.note}</div>}</td>
          <td className="text-right">{formatNumber(l.quantity)}</td><td className="text-right">{formatMoney(l.unitPrice)}</td>
          <td className="text-right">{Number(l.discount) ? formatMoney(l.discount) : ""}</td>
          <td className="text-right">{formatMoney(l.price)}</td><td className="text-right font-bold">{formatMoney(l.amount)}</td>
        </tr>))}</tbody>
    </table>
  );
}

/** Khối tổng tiền bên phải (như KiotViet): Tổng tiền hàng, Giảm giá hóa đơn, Giảm thuế, Khách cần trả, Khách đã trả (đậm). */
export function InvoiceTotals({ inv }: { inv: Invoice }) {
  const qty = inv.lines.reduce((s, l) => s + Number(l.quantity), 0);
  // Giảm thuế (giảm thuế GTGT theo nghị quyết) = phần chênh còn lại giữa tổng hàng − giảm giá và khách cần trả
  const taxCut = Math.max(0, Number(inv.subtotal) - Number(inv.discount) - Number(inv.total));
  const rows = [[`Tổng tiền hàng (${formatNumber(qty)})`, inv.subtotal], ["Giảm giá hóa đơn", inv.discount], ["Giảm thuế", taxCut],
    ["Khách cần trả", inv.total]] as const;
  return (
    <div className="w-[260px] shrink-0 space-y-2.5 text-[13px]">
      {rows.map(([k, v]) => <div key={k} className="grid grid-cols-[1fr_100px] gap-4 text-right"><span>{k}</span><span>{formatMoney(v)}</span></div>)}
      <div className="grid grid-cols-[1fr_100px] gap-4 text-right"><span>Khách đã trả</span><b>{formatMoney(inv.paid)}</b></div>
    </div>
  );
}

/** Tab "Lịch sử thanh toán": các phiếu thu gắn với hóa đơn. */
export function InvoicePaymentHistory({ inv }: { inv: Invoice }) {
  return (
    <div className="p-4">
      <table className="w-full text-[13px]">
        <thead className={SUB_HEAD}><tr><th className="pl-2.5">Mã phiếu</th><th>Thời gian</th><th>Người tạo</th>
          <th className="text-right">Giá trị phiếu</th><th>Phương thức</th><th>Trạng thái</th><th className="pr-2.5 text-right">Tiền thu/chi</th></tr></thead>
        <tbody>
          {!inv.payments.length && <ListEmptyRow cols={7} what="phiếu thanh toán" compact />}
          {inv.payments.map((p) => (
            <tr key={p.voucherId} className="border-b border-[#eff0f3] [&_td]:px-2 [&_td]:py-2.5">
              <td><DocCodeLink code={p.code} kind="/cashbook" /></td><td>{formatDateTime(p.occurredAt)}</td>
              <td>{p.createdByName}</td><td className="text-right">{formatMoney(p.voucherAmount)}</td>
              <td>{FUND_LABEL[p.fund]}</td>
              <td><StatusBadge tone={p.status === "PAID" ? "green" : "red"}>{p.status === "PAID" ? "Đã thanh toán" : "Đã hủy"}</StatusBadge></td>
              <td className="text-right">{formatMoney(p.allocated)}</td>
            </tr>))}
        </tbody>
      </table>
    </div>
  );
}
