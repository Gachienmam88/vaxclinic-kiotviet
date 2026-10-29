"use client";

import { kvSubHead, kvSubRow, kvSubTable } from "@/features/sales/customer-ui-primitives";
import { formatDateTime } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { deliveryNs } from "@/messages/delivery";
import { useShipment } from "./delivery-queries";
import { SHIPMENT_STATUS_KEY, type ShipmentStatus } from "./delivery-types";

/** Tab "Lịch sử giao hàng" ở chi tiết hóa đơn: các lần đổi trạng thái vận đơn (thời gian, người cập nhật, trạng thái, ghi chú). */
export function InvoiceDeliveryHistory({ shipmentId }: { shipmentId: string }) {
  const t = useT(deliveryNs);
  const tc = useT(commonNs);
  const { data } = useShipment(shipmentId);
  const label = (s: string) => (s in SHIPMENT_STATUS_KEY ? t(SHIPMENT_STATUS_KEY[s as ShipmentStatus]) : s);
  if (!data) return <p className="p-4 text-[13px] text-muted-foreground">{tc("status.loading")}</p>;
  return (
    <div className="p-4">
      <table className={kvSubTable}>
        <thead className={kvSubHead}><tr><th>{t("fields.time")}</th><th>{t("detail.updatedBy")}</th><th>{t("fields.status")}</th>
          <th>{t("fields.note")}</th></tr></thead>
        <tbody>{data.logs.map((l, i) => (
          <tr key={i} className={kvSubRow}>
            <td>{formatDateTime(l.changedAt)}</td><td>{l.changedByName}</td>
            <td>{l.fromStatus ? `${label(l.fromStatus)} → ` : ""}<b>{label(l.toStatus)}</b></td><td>{l.note}</td>
          </tr>))}</tbody>
      </table>
    </div>
  );
}
