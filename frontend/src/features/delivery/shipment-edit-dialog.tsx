"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { NumberInput } from "@/components/number-input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { kvDialog, kvDialogBody, kvDialogFooter, kvDialogHeader, kvDialogTitle, kvFooterBtn, kvInput, kvLabel } from "@/features/sales/customer-ui-primitives";
import { api, errorMessage } from "@/lib/api-client";
import { refreshDelivery, usePartnerOptions } from "./delivery-queries";
import { FEE_PAYERS, type ShipmentDetail } from "./delivery-types";

/** Sửa thông tin giao (người nhận, địa chỉ, đối tác, trọng lượng, phí) — chỉ khi Chờ xử lý / Đang lấy hàng. */
export function ShipmentEditDialog({ detail, onClose }: { detail: ShipmentDetail; onClose: () => void }) {
  const qc = useQueryClient();
  const s = detail.item;
  const { data: partners = [] } = usePartnerOptions();
  const [v, setV] = useState({ partnerId: s.partnerId, receiverName: s.receiverName, receiverPhone: s.receiverPhone,
    receiverAddress: s.receiverAddress, area: s.area ?? "", weightGram: detail.weightGram ?? 0, shippingFee: Number(s.shippingFee),
    feePayer: s.feePayer, note: detail.note ?? "" });
  const set = (p: Partial<typeof v>) => setV({ ...v, ...p });
  const save = useMutation({
    mutationFn: () => api(`/shipments/${s.id}`, { method: "PUT", body: { ...v, weightGram: v.weightGram || null } }),
    onSuccess: () => { toast.success(`Đã cập nhật vận đơn ${s.code}`); refreshDelivery(qc); onClose(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const text = (key: "receiverName" | "receiverPhone" | "receiverAddress" | "area" | "note", label: string, required = false) => (
    <label className="block space-y-1"><span className={kvLabel}>{label}{required && " *"}</span>
      <Input required={required} className={kvInput} value={v[key]} onChange={(e) => set({ [key]: e.target.value })} /></label>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={`${kvDialog} sm:max-w-[560px]`}>
        <DialogHeader className={kvDialogHeader}><DialogTitle className={kvDialogTitle}>Sửa vận đơn {s.code}</DialogTitle></DialogHeader>
        <form id="shipment-edit-form" className={`${kvDialogBody} grid grid-cols-2 gap-x-3`} onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          {text("receiverName", "Tên người nhận", true)}{text("receiverPhone", "Số điện thoại", true)}
          <div className="col-span-2">{text("receiverAddress", "Địa chỉ", true)}</div>
          {text("area", "Khu vực")}
          <label className="block space-y-1"><span className={kvLabel}>Đối tác giao hàng *</span>
            <select className={`${kvInput} w-full border px-2`} value={v.partnerId} onChange={(e) => set({ partnerId: e.target.value })}>
              {partners.filter((p) => p.active || p.id === v.partnerId).map((p) => <option key={p.id} value={p.id}>{p.code} - {p.name}</option>)}
            </select></label>
          <label className="block space-y-1"><span className={kvLabel}>Trọng lượng (gram)</span>
            <NumberInput aria-label="Trọng lượng" className={kvInput} value={v.weightGram} onValueChange={(weightGram) => set({ weightGram })} /></label>
          <label className="block space-y-1"><span className={kvLabel}>Phí giao hàng</span>
            <NumberInput aria-label="Phí giao hàng" className={kvInput} value={v.shippingFee} onValueChange={(shippingFee) => set({ shippingFee })} /></label>
          <div className="col-span-2 flex gap-5 text-[13px]">
            {FEE_PAYERS.map(([k, label]) => (
              <label key={k} className="flex items-center gap-1.5"><input type="radio" className="accent-primary" checked={v.feePayer === k}
                onChange={() => set({ feePayer: k })} />{label}</label>))}
          </div>
          <div className="col-span-2">{text("note", "Ghi chú")}</div>
        </form>
        <DialogFooter className={kvDialogFooter}>
          <Button variant="outline" className={kvFooterBtn} onClick={onClose}>Bỏ qua</Button>
          <Button type="submit" form="shipment-edit-form" className={kvFooterBtn} disabled={save.isPending}>Lưu</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
