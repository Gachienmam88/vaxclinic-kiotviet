"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { kvDialog, kvDialogBody, kvDialogFooter, kvDialogHeader, kvDialogTitle, kvFooterBtn } from "@/features/sales/customer-ui-primitives";
import { api, errorMessage } from "@/lib/api-client";
import { refreshDelivery } from "./delivery-queries";
import type { ShipmentDetail } from "./delivery-types";
import { ShipmentDeliveryFields, type DeliveryForm } from "./shipment-delivery-fields";

/** Sửa thông tin giao (người nhận, địa chỉ, đối tác, trọng lượng, phí) — chỉ khi Chờ xử lý / Đang lấy hàng. */
export function ShipmentEditDialog({ detail, onClose }: { detail: ShipmentDetail; onClose: () => void }) {
  const qc = useQueryClient();
  const s = detail.item;
  const [v, setV] = useState<DeliveryForm>({ partnerId: s.partnerId, receiverName: s.receiverName, receiverPhone: s.receiverPhone,
    receiverAddress: s.receiverAddress, area: s.area ?? "", weightGram: detail.weightGram ?? 0, shippingFee: Number(s.shippingFee),
    feePayer: s.feePayer, note: detail.note ?? "" });
  const save = useMutation({
    mutationFn: () => api(`/shipments/${s.id}`, { method: "PUT", body: { ...v, weightGram: v.weightGram || null } }),
    onSuccess: () => { toast.success(`Đã cập nhật vận đơn ${s.code}`); refreshDelivery(qc); onClose(); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={`${kvDialog} sm:max-w-[560px]`}>
        <DialogHeader className={kvDialogHeader}><DialogTitle className={kvDialogTitle}>Sửa vận đơn {s.code}</DialogTitle></DialogHeader>
        <form id="shipment-edit-form" className={`${kvDialogBody} grid grid-cols-2 gap-x-3`} onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <ShipmentDeliveryFields v={v} set={(p) => setV({ ...v, ...p })} />
        </form>
        <DialogFooter className={kvDialogFooter}>
          <Button variant="outline" className={kvFooterBtn} onClick={onClose}>Bỏ qua</Button>
          <Button type="submit" form="shipment-edit-form" className={kvFooterBtn} disabled={save.isPending}>Lưu</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
