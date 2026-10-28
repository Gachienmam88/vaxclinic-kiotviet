"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DocCodeLink } from "@/components/ui/doc-code-link";
import { DetailTabsList } from "@/components/ui/detail-tabs-list";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { DETAIL_BTN, DETAIL_PANEL, DETAIL_TAB, DETAIL_TABS_LIST, StatusBadge, SUB_HEAD } from "@/features/sales/invoice-list-kit";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { useCurrentUser } from "@/lib/use-current-user";
import { cn } from "@/lib/utils";
import { useShipment } from "./delivery-queries";
import { NEXT_STATUSES, SHIPMENT_TONE, shipmentStatusLabel } from "./delivery-types";
import { ShipmentEditDialog } from "./shipment-edit-dialog";
import { ShipmentReturnedDialog } from "./shipment-returned-dialog";
import { confirmStatus, useShipmentStatus } from "./use-shipment-status";

/**
 * Chi tiết vận đơn mở dưới dòng: Thông tin (người nhận, đối tác, phí, thu hộ, phiếu trả hàng, đối soát) + Lịch sử trạng thái
 * (thời gian + người cập nhật). Nút đổi trạng thái chỉ hiện các bước hợp lệ; Hủy chỉ hủy vận đơn (hóa đơn giữ nguyên);
 * Đã chuyển hoàn mở hộp thoại chọn cách hoàn tiền + phí cửa hàng chịu.
 */
export function ShipmentDetailPanel({ id, onClose }: { id: string; onClose?: () => void }) {
  const { can } = useCurrentUser();
  const { data: d } = useShipment(id);
  const [editing, setEditing] = useState(false);
  const [returning, setReturning] = useState(false);
  const status = useShipmentStatus(() => setReturning(false));
  if (!d) return <div className={cn(DETAIL_PANEL, "p-6 text-muted-foreground")}>Đang tải...</div>;
  const s = d.item;
  const next = NEXT_STATUSES[s.status];
  const fee = d.feePosted == null ? null : d.returnFee > 0
    ? `${formatMoney(d.feePosted)} (gồm phí chuyển hoàn ${formatMoney(d.returnFee)})` : formatMoney(d.feePosted);
  const row = (label: string, value: React.ReactNode) => (
    <div className="flex min-h-[26px] items-start gap-2"><span className="w-32 shrink-0 text-muted-foreground">{label}:</span><span>{value ?? "—"}</span></div>
  );

  return (
    <div className={DETAIL_PANEL}>
      <Tabs defaultValue="info" className="gap-0">
        <DetailTabsList onActiveTabClick={onClose} variant="line" className={DETAIL_TABS_LIST}>
          <TabsTrigger value="info" className={DETAIL_TAB}>Thông tin</TabsTrigger>
          <TabsTrigger value="logs" className={DETAIL_TAB}>Lịch sử trạng thái</TabsTrigger>
        </DetailTabsList>
        <TabsContent value="info">
          <div className="space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-base font-bold">{s.code}</span>
              <StatusBadge tone={SHIPMENT_TONE[s.status]}>{shipmentStatusLabel(s.status)}</StatusBadge>
              {s.reconciled && <StatusBadge tone="green">Đã đối soát <DocCodeLink code={d.settlementCode} /></StatusBadge>}
              <span className="ml-auto text-muted-foreground">Người tạo: {d.createdByName} — {formatDateTime(s.createdAt)}</span>
            </div>
            <div className="grid grid-cols-1 gap-x-8 text-xs md:grid-cols-3">
              <div>{row("Hóa đơn", <DocCodeLink code={s.invoiceCode} kind="/invoices" />)}{row("Khách hàng", s.customerName)}{row("Người nhận", `${s.receiverName} - ${s.receiverPhone}`)}
                {row("Địa chỉ", s.receiverAddress)}{row("Khu vực", s.area)}</div>
              <div>{row("Đối tác giao hàng", s.partnerName)}{row("Trọng lượng", d.weightGram ? `${formatNumber(d.weightGram)} g` : null)}
                {row("Phí giao hàng", `${formatMoney(s.shippingFee)} (${s.feePayer === "SHOP" ? "cửa hàng trả" : "người nhận trả"})`)}
                {row("Phí cửa hàng chịu", fee)}{row("Thời gian hoàn tất", d.deliveredAt ? formatDateTime(d.deliveredAt) : null)}</div>
              <div>{row("Tổng hóa đơn", formatMoney(d.invoiceTotal))}{row("Khách đã trả", formatMoney(d.invoicePaid))}
                {row("Thu hộ (COD)", <b className="text-primary">{formatMoney(s.codAmount)}</b>)}{row("Phiếu trả hàng", d.returnCode && <DocCodeLink code={d.returnCode} kind="/returns" />)}</div>
            </div>
            <p className="min-h-10 rounded-md border px-3 py-2 text-muted-foreground">{d.note || "Chưa có ghi chú"}</p>
          </div>
          {can("sales.perform") && (
            <div className="flex flex-wrap items-center gap-2 border-t px-4 py-2.5">
              {(s.status === "PENDING" || s.status === "PICKING") && (
                <Button variant="outline" className={DETAIL_BTN} onClick={() => setEditing(true)}><Pencil className="size-4" /> Sửa thông tin</Button>)}
              <div className="ml-auto flex flex-wrap gap-2">
                {next.map((to) => (
                  <Button key={to} variant={to === "CANCELLED" ? "ghost" : to === "DELIVERED" ? "default" : "outline"} className={DETAIL_BTN}
                    disabled={status.isPending} onClick={() => to === "RETURNED" ? setReturning(true)
                      : confirmStatus(to, 1) && status.mutate({ ids: [s.id], status: to })}>
                    {shipmentStatusLabel(to)}</Button>))}
              </div>
            </div>)}
        </TabsContent>
        <TabsContent value="logs">
          <table className="w-full text-[13px]">
            <thead className={SUB_HEAD}><tr><th>Thời gian</th><th>Người cập nhật</th><th>Trạng thái</th><th>Ghi chú</th></tr></thead>
            <tbody>{d.logs.map((l, i) => (
              <tr key={i} className="border-b [&_td]:h-[30px] [&_td]:px-2">
                <td>{formatDateTime(l.changedAt)}</td><td>{l.changedByName}</td>
                <td>{l.fromStatus ? `${shipmentStatusLabel(l.fromStatus)} → ` : ""}<b>{shipmentStatusLabel(l.toStatus)}</b></td><td>{l.note}</td>
              </tr>))}</tbody>
          </table>
        </TabsContent>
      </Tabs>
      {editing && <ShipmentEditDialog detail={d} onClose={() => setEditing(false)} />}
      {returning && <ShipmentReturnedDialog count={1} pending={status.isPending} onClose={() => setReturning(false)}
        single={{ code: s.code, shippingFee: s.shippingFee, paid: d.invoicePaid, walkIn: s.customerName === "Khách lẻ" }}
        onSubmit={(opts) => status.mutate({ ids: [s.id], status: "RETURNED", opts })} />}
    </div>
  );
}
