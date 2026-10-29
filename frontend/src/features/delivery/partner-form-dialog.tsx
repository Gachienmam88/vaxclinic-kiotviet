"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toVnAddress, VnAddressFields, type VnAddress } from "@/components/ui/vn-address-fields";
import { kvDialog, kvDialogFooter, kvDialogHeader, kvDialogTitle, kvFooterBtn } from "@/features/sales/customer-ui-primitives";
import { api, errorMessage } from "@/lib/api-client";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { deliveryNs } from "@/messages/delivery";
import { refreshDelivery } from "./delivery-queries";
import type { DeliveryPartner } from "./delivery-types";
import { PartnerGroupSelect } from "./partner-group-select";

const LINE = "h-9 w-full min-w-0 border-0 border-b border-[#c8ccd2] bg-transparent px-0 text-[13px] outline-none placeholder:text-[#9ca3af] focus:border-primary rounded-none shadow-none";

/** Dòng form như KiotViet: nhãn trái 160px, ô gạch chân phải. */
function Row({ label, required, children, htmlFor }: { label: string; required?: boolean; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div className="grid min-h-10 grid-cols-[160px_1fr] items-center gap-3">
      <label htmlFor={htmlFor} className="text-[13px]">{label}{required && <span className="text-destructive">*</span>}</label>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/**
 * Thêm / sửa đối tác giao hàng (KiotViet): Loại đối tác Cá nhân / Công ty, Mã (trống = tự sinh DT...), Tên*, Điện thoại, Email,
 * Địa chỉ chi tiết, Khu vực, Phường/Xã, Nhóm đối tác, Ghi chú; sửa thêm Trạng thái. Kết nối: tự cập nhật trạng thái (MANUAL).
 * onSaved: nhận đối tác đã lưu (màn bán hàng chọn luôn đối tác vừa thêm).
 */
export function PartnerFormDialog({ partner, onClose, onSaved }: {
  partner?: DeliveryPartner; onClose: () => void; onSaved?: (p: DeliveryPartner) => void;
}) {
  const t = useT(deliveryNs);
  const tc = useT(commonNs);
  const qc = useQueryClient();
  const [v, setV] = useState({ code: partner?.code ?? "", name: partner?.name ?? "", phone: partner?.phone ?? "", email: partner?.email ?? "",
    note: partner?.note ?? "", active: partner?.active ?? true, partnerKind: partner?.partnerKind ?? "PERSONAL", groupId: partner?.groupId ?? "" });
  const [addr, setAddr] = useState<VnAddress>(() => toVnAddress(partner?.address, partner?.provinceCode, partner?.province,
    partner?.wardCode, partner?.ward));
  const set = (p: Partial<typeof v>) => setV({ ...v, ...p });
  const save = useMutation({
    mutationFn: () => {
      const body = { ...v, groupId: v.groupId || null, partnerType: "MANUAL", address: addr.address, province: addr.provinceName,
        ward: addr.wardName, provinceCode: addr.provinceCode, wardCode: addr.wardCode };
      return partner ? api<DeliveryPartner>(`/delivery-partners/${partner.id}`, { method: "PUT", body })
        : api<DeliveryPartner>("/delivery-partners", { method: "POST", body });
    },
    onSuccess: (p) => { toast.success(t(partner ? "partner.updated" : "partner.added")); refreshDelivery(qc); onSaved?.(p); onClose(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const input = (key: "code" | "name" | "phone" | "email", extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <input id={`partner-${key}`} className={LINE} value={v[key]} onChange={(e) => set({ [key]: e.target.value })} {...extra} />
  );
  const radio = <T extends string | boolean>(name: string, options: readonly (readonly [T, string])[], value: T, onPick: (x: T) => void) => (
    <div className="flex items-center gap-6 text-[13px]" role="radiogroup">
      {options.map(([o, l]) => (
        <label key={String(o)} className="flex cursor-pointer items-center gap-2">
          <input type="radio" name={name} className="size-4 accent-primary" checked={value === o} onChange={() => onPick(o)} />{l}</label>))}
    </div>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={`${kvDialog} sm:max-w-[450px]`}>
        <DialogHeader className={kvDialogHeader}>
          <DialogTitle className={kvDialogTitle}>{t(partner ? "partner.titleEdit" : "partner.titleNew")}</DialogTitle>
        </DialogHeader>
        <form id="partner-form" className="max-h-[70vh] overflow-y-auto px-5 pb-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <Row label={t("partner.kind")}>{radio("partner-kind", [["PERSONAL", t("partner.kinds.PERSONAL")], ["COMPANY", t("partner.kinds.COMPANY")]] as const,
            v.partnerKind, (partnerKind) => set({ partnerKind }))}</Row>
          <Row label={t("partner.code")} htmlFor="partner-code">{input("code", { placeholder: t("partner.codePlaceholder"), maxLength: 30 })}</Row>
          <Row label={t("partner.name")} required htmlFor="partner-name">{input("name", { required: true, autoFocus: true, maxLength: 200 })}</Row>
          <Row label={tc("fields.phone")} htmlFor="partner-phone">{input("phone", { maxLength: 20, inputMode: "tel" })}</Row>
          <Row label={tc("fields.email")} htmlFor="partner-email">{input("email", { type: "email", maxLength: 150 })}</Row>
          <VnAddressFields idPrefix="partner" value={addr} onChange={setAddr} controlClassName={LINE}
            labels={{ address: t("partner.addressDetail"), province: t("partner.area"), ward: t("partner.ward") }}
            addressPlaceholder={t("partner.addressPlaceholder")} selectPlaceholders={{ province: "", ward: "" }}
            renderRow={(key, label, control) => <Row key={key} label={label} htmlFor={`partner-${key}`}>{control}</Row>} />
          <Row label={t("partner.group")}><PartnerGroupSelect value={v.groupId} onChange={(groupId) => set({ groupId })} className={LINE} /></Row>
          <Row label={tc("fields.note")} htmlFor="partner-note">
            <textarea id="partner-note" maxLength={2000} rows={2} className={`${LINE} h-auto min-h-9 resize-none py-2`} value={v.note}
              onChange={(e) => set({ note: e.target.value })} /></Row>
          {partner && <Row label={tc("fields.status")}>{radio("partner-active", [[true, tc("status.active")], [false, tc("status.inactive")]] as const,
            v.active, (active) => set({ active }))}</Row>}
        </form>
        <DialogFooter className={`${kvDialogFooter} border-t-0`}>
          <Button variant="outline" className={`${kvFooterBtn} min-w-[90px] border-primary text-primary`} onClick={onClose}>{tc("actions.skip")}</Button>
          <Button type="submit" form="partner-form" className={`${kvFooterBtn} min-w-[90px]`} disabled={save.isPending || !v.name.trim()}>{tc("actions.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
