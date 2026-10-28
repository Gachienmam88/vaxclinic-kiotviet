"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toVnAddress, VnAddressFields, type VnAddress } from "@/components/ui/vn-address-fields";
import { kvDialog, kvDialogBody, kvDialogFooter, kvDialogHeader, kvDialogTitle, kvFooterBtn, kvInput, kvLabel } from "@/features/sales/customer-ui-primitives";
import { api, errorMessage } from "@/lib/api-client";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { deliveryNs } from "@/messages/delivery";
import { refreshDelivery } from "./delivery-queries";
import type { DeliveryPartner } from "./delivery-types";

/**
 * Thêm / sửa đối tác giao hàng: mã (trống = tự sinh DT...), tên, SĐT, email, địa chỉ, ghi chú, trạng thái.
 * Loại "Tự cập nhật" (MANUAL): chưa kết nối API hãng vận chuyển (GHN, GHTK... cần hợp đồng riêng).
 */
export function PartnerFormDialog({ partner, onClose }: { partner?: DeliveryPartner; onClose: () => void }) {
  const t = useT(deliveryNs);
  const tc = useT(commonNs);
  const qc = useQueryClient();
  const [v, setV] = useState({ code: partner?.code ?? "", name: partner?.name ?? "", phone: partner?.phone ?? "", email: partner?.email ?? "",
    note: partner?.note ?? "", active: partner?.active ?? true });
  const [addr, setAddr] = useState<VnAddress>(() => toVnAddress(partner?.address, partner?.provinceCode, partner?.province,
    partner?.wardCode, partner?.ward));
  const set = (p: Partial<typeof v>) => setV({ ...v, ...p });
  const save = useMutation({
    mutationFn: () => {
      const body = { ...v, partnerType: "MANUAL", address: addr.address, province: addr.provinceName, ward: addr.wardName,
        provinceCode: addr.provinceCode, wardCode: addr.wardCode };
      return partner ? api(`/delivery-partners/${partner.id}`, { method: "PUT", body }) : api("/delivery-partners", { method: "POST", body });
    },
    onSuccess: () => { toast.success(t(partner ? "partner.updated" : "partner.added")); refreshDelivery(qc); onClose(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const field = (key: "code" | "name" | "phone" | "email", label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block space-y-1"><span className={kvLabel}>{label}</span>
      <Input className={kvInput} value={v[key]} onChange={(e) => set({ [key]: e.target.value })} {...extra} /></label>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={`${kvDialog} sm:max-w-[560px]`}>
        <DialogHeader className={kvDialogHeader}>
          <DialogTitle className={kvDialogTitle}>{t(partner ? "partner.titleEdit" : "partner.titleNew")}</DialogTitle>
        </DialogHeader>
        <form id="partner-form" className={`${kvDialogBody} grid grid-cols-2 gap-x-3`} onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          {field("code", t("partner.code"), { placeholder: t("partner.codePlaceholder"), maxLength: 30 })}
          {field("name", `${t("partner.name")} *`, { required: true, autoFocus: true, maxLength: 200 })}
          {field("phone", tc("fields.phone"), { maxLength: 20 })}
          {field("email", tc("fields.email"), { type: "email", maxLength: 150 })}
          <VnAddressFields idPrefix="partner" value={addr} onChange={setAddr} fieldClassName="block space-y-1"
            addressFieldClassName="col-span-2" labelClassName={kvLabel} controlClassName={kvInput} />
          <label className="col-span-2 block space-y-1"><span className={kvLabel}>{tc("fields.note")}</span>
            <textarea maxLength={2000} className="min-h-16 w-full rounded-md border border-[#d9dbe0] px-2.5 py-1.5 text-[13px] outline-none focus:border-primary"
              value={v.note} onChange={(e) => set({ note: e.target.value })} /></label>
          <div className="col-span-2 flex items-center gap-5 text-[13px]">
            <span className={kvLabel}>{tc("fields.status")}</span>
            {([[true, tc("status.active")], [false, tc("status.inactive")]] as const).map(([a, l]) => (
              <label key={l} className="flex items-center gap-1.5"><input type="radio" className="accent-primary" checked={v.active === a}
                onChange={() => set({ active: a })} />{l}</label>))}
            <span className="ml-auto text-xs text-muted-foreground">{t("partner.connectionShort")}</span>
          </div>
        </form>
        <DialogFooter className={kvDialogFooter}>
          <Button variant="outline" className={kvFooterBtn} onClick={onClose}>{tc("actions.skip")}</Button>
          <Button type="submit" form="partner-form" className={kvFooterBtn} disabled={save.isPending || !v.name.trim()}>{tc("actions.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
