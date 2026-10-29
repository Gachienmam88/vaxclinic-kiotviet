"use client";

import { SUB_HEAD, StatusBadge } from "@/features/sales/invoice-list-kit";
import { enumLabel } from "@/features/sales/i18n-enum-label";
import { useInvoice } from "@/features/sales/sales-queries";
import { useTaxSettings } from "@/features/accounting/tax-queries";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { ordersNs } from "@/messages/orders";
import { salesNs } from "@/messages/sales";
import type { Order } from "./order-types";
import { ListEmptyRow } from "@/components/ui/list-empty-state";
import { DocCodeLink } from "@/components/ui/doc-code-link";

/**
 * Khối tổng tiền bên phải chi tiết đơn (như KiotViet): tổng tiền hàng, giảm giá, Thuế GTGT (nhãn theo ngành nghề thuế mặc định
 * của cửa hàng), Giảm thuế, khách cần trả, khách đã trả (đặt cọc). Đơn đặt hàng không lưu thuế → 2 dòng thuế luôn 0đ.
 */
export function OrderTotals({ order }: { order: Order }) {
  const t = useT(ordersNs);
  const { data: tax } = useTaxSettings();
  const sector = tax?.sectors.find((x) => x.code === tax.defaultSector);
  const vatLabel = sector ? `${t("kv.detail.vat")} (${sector.name} ${formatNumber(sector.vatRate)}%)` : t("kv.detail.vat");
  const qty = order.lines.reduce((s, l) => s + Number(l.quantity), 0);
  const rows = [[t("totals.subtotal", { qty: formatNumber(qty) }), order.subtotal], [t("totals.discount"), order.discount],
    [vatLabel, 0], [t("kv.detail.taxCut"), 0], [t("totals.total"), order.total]] as const;
  return (
    <div className="w-[340px] shrink-0 space-y-2.5 text-[13px]">
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

/** Tab "Lịch sử hóa đơn" (khi đơn đã tạo hóa đơn): mã hóa đơn (link), thời gian, người tạo, giá trị, trạng thái. */
export function OrderInvoiceHistory({ invoiceId }: { invoiceId: string }) {
  const t = useT(ordersNs);
  const { data: inv } = useInvoice(invoiceId);
  const head = ["invCode", "invTime", "invBy", "invValue", "invStatus"] as const;
  return (
    <div className="p-4">
      <table className="w-full text-[13px]">
        <thead className={SUB_HEAD}><tr>{head.map((k, i) => <th key={k} className={i === 0 ? "pl-2.5" : i === 3 ? "text-right" : ""}>
          {t(`kv.detail.${k}`)}</th>)}</tr></thead>
        <tbody>{inv && (
          <tr className="border-b border-[#eff0f3] [&_td]:px-2 [&_td]:py-2.5">
            <td><DocCodeLink code={inv.code} kind="/invoices" /></td><td>{formatDateTime(inv.soldAt)}</td><td>{inv.createdByName}</td>
            <td className="text-right">{formatMoney(inv.total)}</td>
            <td><StatusBadge tone={inv.status === "CANCELLED" ? "red" : "green"}>
              {t(inv.status === "CANCELLED" ? "kv.detail.invStatuses.CANCELLED" : "kv.detail.invStatuses.COMPLETED")}</StatusBadge></td>
          </tr>)}</tbody>
      </table>
    </div>
  );
}
