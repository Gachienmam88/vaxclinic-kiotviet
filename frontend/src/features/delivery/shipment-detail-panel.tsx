"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DocCodeLink } from "@/components/ui/doc-code-link";
import { DetailTabsList } from "@/components/ui/detail-tabs-list";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { DETAIL_BTN, DETAIL_PANEL, DETAIL_TAB, DETAIL_TABS_LIST, StatusBadge, SUB_HEAD } from "@/features/sales/invoice-list-kit";
import { formatDateTime } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { renderRichText } from "@/lib/i18n/render-rich-text";
import { useCurrentUser } from "@/lib/use-current-user";
import { cn } from "@/lib/utils";
import { commonNs } from "@/messages/common";
import { deliveryNs } from "@/messages/delivery";
import { useShipment } from "./delivery-queries";
import { NEXT_STATUSES, SHIPMENT_STATUS_KEY, SHIPMENT_TONE, type ShipmentStatus } from "./delivery-types";
import { ShipmentDetailInfo } from "./shipment-detail-info";
import { ShipmentEditDialog } from "./shipment-edit-dialog";
import { ShipmentReturnedDialog } from "./shipment-returned-dialog";
import { confirmStatus, useShipmentStatus } from "./use-shipment-status";

/**
 * Chi tiết vận đơn mở dưới dòng (KiotViet): tab Thông tin (người nhận, hóa đơn, thông tin vận chuyển) + tab Lịch sử giao hàng
 * (mỗi lần đổi trạng thái: thời gian, đối tác, người tạo, trạng thái). Chân: sửa thông tin giao (chưa lấy hàng), đổi trạng thái
 * theo bước hợp lệ; Đã chuyển hoàn mở hộp thoại hoàn tiền + phí cửa hàng chịu.
 */
export function ShipmentDetailPanel({ id, onClose }: { id: string; onClose?: () => void }) {
  const t = useT(deliveryNs);
  const tc = useT(commonNs);
  const { can } = useCurrentUser();
  const { data: d } = useShipment(id);
  const [editing, setEditing] = useState(false);
  const [returning, setReturning] = useState(false);
  const status = useShipmentStatus(() => setReturning(false));
  if (!d) return <div className={cn(DETAIL_PANEL, "p-6 text-muted-foreground")}>{tc("status.loading")}</div>;
  const s = d.item;
  const next = NEXT_STATUSES[s.status];
  const badge = (v: string) => <StatusBadge tone={SHIPMENT_TONE[v as ShipmentStatus] ?? "gray"}>
    {t(SHIPMENT_STATUS_KEY[v as ShipmentStatus] ?? "status.PENDING")}</StatusBadge>;

  return (
    <div className={DETAIL_PANEL}>
      <Tabs defaultValue="info" className="gap-0">
        <DetailTabsList onActiveTabClick={onClose} variant="line" className={DETAIL_TABS_LIST}>
          <TabsTrigger value="info" className={DETAIL_TAB}>{t("detail.tabInfo")}</TabsTrigger>
          <TabsTrigger value="logs" className={DETAIL_TAB}>{t("kv.partners.history")}</TabsTrigger>
        </DetailTabsList>
        <TabsContent value="info">
          <ShipmentDetailInfo d={d} />
          {(s.reconciled || d.returnCode) && (
            <div className="flex flex-wrap gap-2 px-4 pb-3">
              {s.reconciled && <StatusBadge tone="green">{renderRichText(t("detail.reconciled"), { code: <DocCodeLink code={d.settlementCode} /> })}</StatusBadge>}
              {d.returnCode && <StatusBadge tone="red">{renderRichText(t("invoiceInfo.returnDoc"), { code: <DocCodeLink code={d.returnCode} kind="/returns" /> })}</StatusBadge>}
            </div>)}
          {can("sales.perform") && (next.length > 0 || ["PENDING", "PICKING", "WAIT_REPICK"].includes(s.status)) && (
            <div className="flex flex-wrap items-center gap-2 border-t px-4 py-2.5">
              {["PENDING", "PICKING", "WAIT_REPICK"].includes(s.status) && (
                <Button variant="outline" className={DETAIL_BTN} onClick={() => setEditing(true)}><Pencil className="size-4" /> {t("detail.editInfo")}</Button>)}
              <div className="ml-auto flex flex-wrap gap-2">
                {next.map((to) => (
                  <Button key={to} variant={to === "CANCELLED" ? "ghost" : to === "DELIVERED" ? "default" : "outline"} className={DETAIL_BTN}
                    disabled={status.isPending} onClick={() => to === "RETURNED" ? setReturning(true)
                      : confirmStatus(t, to, 1) && status.mutate({ ids: [s.id], status: to })}>
                    {t(SHIPMENT_STATUS_KEY[to])}</Button>))}
              </div>
            </div>)}
        </TabsContent>
        <TabsContent value="logs">
          <div className="p-4">
            <table className="w-full text-[13px]">
              <thead className={SUB_HEAD}><tr><th className="pl-2.5">{t("kv.detail.histTime")}</th><th>{t("kv.detail.histPartner")}</th>
                <th>{t("kv.detail.histBy")}</th><th>{t("kv.detail.histStatus")}</th></tr></thead>
              <tbody>{[...d.logs].reverse().map((l, i) => (
                <tr key={i} className="border-b [&_td]:h-[34px] [&_td]:px-2" title={l.note ?? undefined}>
                  <td className="pl-2.5">{formatDateTime(l.changedAt)}</td><td>{s.partnerName}</td><td>{l.changedByName}</td><td>{badge(l.toStatus)}</td>
                </tr>))}</tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
      {editing && <ShipmentEditDialog detail={d} onClose={() => setEditing(false)} />}
      {returning && <ShipmentReturnedDialog count={1} pending={status.isPending} onClose={() => setReturning(false)}
        single={{ code: s.code, shippingFee: s.shippingFee, paid: d.invoicePaid, walkIn: s.customerName === "Khách lẻ" }}
        onSubmit={(opts) => status.mutate({ ids: [s.id], status: "RETURNED", opts })} />}
    </div>
  );
}
