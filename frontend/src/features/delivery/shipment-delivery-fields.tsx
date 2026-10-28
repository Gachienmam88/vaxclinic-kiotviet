"use client";

import { NumberInput } from "@/components/number-input";
import { Input } from "@/components/ui/input";
import { VnAddressFields } from "@/components/ui/vn-address-fields";
import { kvInput, kvLabel } from "@/features/sales/customer-ui-primitives";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { deliveryNs } from "@/messages/delivery";
import { fromDeliveryAddress, toDeliveryAddress, type DeliveryAreaFields } from "./delivery-address";
import { usePartnerOptions } from "./delivery-queries";
import { FEE_PAYER_KEY, FEE_PAYERS } from "./delivery-types";

/** Thông tin giao của vận đơn (dùng cho "Sửa vận đơn" và "Tạo vận đơn" từ chi tiết hóa đơn). */
export type DeliveryForm = DeliveryAreaFields & {
  partnerId: string; receiverName: string; receiverPhone: string; weightGram: number;
  shippingFee: number; feePayer: "SHOP" | "CUSTOMER"; note: string;
};

/** Ô nhập người nhận, địa chỉ, đối tác (chỉ đối tác đang hoạt động + đối tác đang chọn), trọng lượng, phí, người trả phí. */
export function ShipmentDeliveryFields({ v, set }: { v: DeliveryForm; set: (p: Partial<DeliveryForm>) => void }) {
  const t = useT(deliveryNs);
  const tc = useT(commonNs);
  const { data: partners = [] } = usePartnerOptions();
  const text = (key: "receiverName" | "receiverPhone" | "note", label: string, required = false) => (
    <label className="block space-y-1"><span className={kvLabel}>{label}{required && " *"}</span>
      <Input required={required} className={kvInput} value={v[key]} onChange={(e) => set({ [key]: e.target.value })} /></label>
  );
  return (
    <>
      {text("receiverName", t("fields.receiverName"), true)}{text("receiverPhone", t("fields.phone"), true)}
      <VnAddressFields idPrefix="shipment" value={toDeliveryAddress(v)} onChange={(a) => set(fromDeliveryAddress(a))} addressRequired
        fieldClassName="block space-y-1" addressFieldClassName="col-span-2" labelClassName={kvLabel} controlClassName={kvInput}
        labels={{ address: `${tc("address.address")} *` }} />
      <label className="block space-y-1"><span className={kvLabel}>{t("fields.partner")} *</span>
        <select required className={`${kvInput} w-full border px-2`} value={v.partnerId} onChange={(e) => set({ partnerId: e.target.value })}>
          {!v.partnerId && <option value="">{t("form.pickPartner")}</option>}
          {partners.filter((p) => p.active || p.id === v.partnerId).map((p) => <option key={p.id} value={p.id}>{p.code} - {p.name}</option>)}
        </select></label>
      <label className="block space-y-1"><span className={kvLabel}>{t("fields.weightGram")}</span>
        <NumberInput aria-label={t("fields.weight")} className={kvInput} value={v.weightGram} onValueChange={(weightGram) => set({ weightGram })} /></label>
      <label className="block space-y-1"><span className={kvLabel}>{t("fields.fee")}</span>
        <NumberInput aria-label={t("fields.fee")} className={kvInput} value={v.shippingFee} onValueChange={(shippingFee) => set({ shippingFee })} /></label>
      <div className="col-span-2 flex gap-5 text-[13px]">
        {FEE_PAYERS.map(([k]) => (
          <label key={k} className="flex items-center gap-1.5"><input type="radio" className="accent-primary" checked={v.feePayer === k}
            onChange={() => set({ feePayer: k })} />{t(FEE_PAYER_KEY[k])}</label>))}
      </div>
      <div className="col-span-2">{text("note", t("fields.note"))}</div>
    </>
  );
}
