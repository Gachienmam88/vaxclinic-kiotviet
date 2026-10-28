"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { kvDialog, kvDialogBody, kvDialogFooter, kvDialogHeader, kvDialogTitle, kvFooterBtn } from "@/features/sales/customer-ui-primitives";
import type { Invoice } from "@/features/sales/sales-types";
import { api, errorMessage } from "@/lib/api-client";
import { formatMoney } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { renderRichText } from "@/lib/i18n/render-rich-text";
import { commonNs } from "@/messages/common";
import { deliveryNs } from "@/messages/delivery";
import { refreshDelivery } from "./delivery-queries";
import type { ShipmentDetail } from "./delivery-types";
import { areaFromServer } from "./delivery-address";
import { ShipmentDeliveryFields, type DeliveryForm } from "./shipment-delivery-fields";

/**
 * "Tạo vận đơn" cho hóa đơn chưa có vận đơn đang hoạt động (vận đơn cũ đã hủy → giao lại, thường qua đối tác khác).
 * Người nhận điền sẵn theo vận đơn cũ; thu hộ = khách cần trả − đã trả (server tính).
 */
export function ShipmentCreateDialog({ inv, onClose }: { inv: Invoice; onClose: () => void }) {
  const t = useT(deliveryNs);
  const tc = useT(commonNs);
  const qc = useQueryClient();
  const old = inv.shipment;
  const [v, setV] = useState<DeliveryForm>({ partnerId: "", receiverName: old?.receiverName ?? inv.customerName,
    receiverPhone: old?.receiverPhone ?? inv.customerPhone ?? "", receiverAddress: old?.receiverAddress ?? "",
    ...areaFromServer({ area: old?.area ?? null, provinceCode: old?.provinceCode, wardCode: old?.wardCode }),
    weightGram: old?.weightGram ?? 0, shippingFee: Number(old?.shippingFee ?? 0), feePayer: old?.feePayer ?? "SHOP", note: "" });
  const save = useMutation({
    mutationFn: () => api<ShipmentDetail>("/shipments", { method: "POST",
      body: { invoiceId: inv.id, delivery: { ...v, weightGram: v.weightGram || null } } }),
    onSuccess: (d) => { toast.success(t("form.created", { code: d.item.code })); refreshDelivery(qc); onClose(); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={`${kvDialog} sm:max-w-[560px]`}>
        <DialogHeader className={kvDialogHeader}><DialogTitle className={kvDialogTitle}>{t("form.createTitle", { code: inv.code })}</DialogTitle></DialogHeader>
        <form id="shipment-create-form" className={`${kvDialogBody} grid grid-cols-2 gap-x-3`} onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <p className="col-span-2 text-[13px]">{renderRichText(t("form.createCod"),
            { amount: <b className="text-primary">{formatMoney(Math.max(0, Number(inv.total) - Number(inv.paid)))}</b> })}</p>
          <ShipmentDeliveryFields v={v} set={(p) => setV({ ...v, ...p })} />
        </form>
        <DialogFooter className={kvDialogFooter}>
          <Button variant="outline" className={kvFooterBtn} onClick={onClose}>{tc("actions.skip")}</Button>
          <Button type="submit" form="shipment-create-form" className={kvFooterBtn} disabled={save.isPending || !v.partnerId}>{t("form.createSubmit")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
