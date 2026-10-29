"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FILTER_FIELD } from "@/features/sales/invoice-list-kit";
import { useT } from "@/lib/i18n";
import { renderRichText } from "@/lib/i18n/render-rich-text";
import { cn } from "@/lib/utils";
import { commonNs } from "@/messages/common";
import { deliveryNs } from "@/messages/delivery";
import { SHIPMENT_STATUS_KEY, SHIPMENT_STATUSES, type ShipmentStatus } from "./delivery-types";
import { ShipmentReturnedDialog } from "./shipment-returned-dialog";
import { confirmStatus, useShipmentStatus } from "./use-shipment-status";

/** Thanh thao tác khi chọn nhiều vận đơn: cập nhật trạng thái hàng loạt (Đã chuyển hoàn mở hộp thoại hoàn tiền). */
export function ShipmentBulkBar({ selected, onDone }: { selected: string[]; onDone: () => void }) {
  const t = useT(deliveryNs);
  const tc = useT(commonNs);
  const [target, setTarget] = useState<ShipmentStatus | "">("");
  const [returned, setReturned] = useState(false);
  const status = useShipmentStatus(() => { setTarget(""); setReturned(false); onDone(); });
  if (!selected.length) return null;
  const apply = () => target === "RETURNED" ? setReturned(true)
    : target && confirmStatus(t, target, selected.length) && status.mutate({ ids: selected, status: target });
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-primary-tint px-4 py-2 text-[13px]">
      <span>{renderRichText(t("manage.selected"), { n: <b>{selected.length}</b> })}</span>
      <select aria-label={t("manage.bulkAria")} className={cn(FILTER_FIELD, "w-52")} value={target} onChange={(e) => setTarget(e.target.value as ShipmentStatus)}>
        <option value="">{t("manage.bulkPlaceholder")}</option>
        {SHIPMENT_STATUSES.map(([k]) => <option key={k} value={k}>{t(SHIPMENT_STATUS_KEY[k])}</option>)}
      </select>
      <Button size="sm" disabled={!target || status.isPending} onClick={apply}>{tc("actions.update")}</Button>
      <Button size="sm" variant="ghost" onClick={onDone}>{tc("actions.clearSelection")}</Button>
      {returned && <ShipmentReturnedDialog count={selected.length} pending={status.isPending} onClose={() => setReturned(false)}
        onSubmit={(opts) => status.mutate({ ids: selected, status: "RETURNED", opts })} />}
    </div>
  );
}
