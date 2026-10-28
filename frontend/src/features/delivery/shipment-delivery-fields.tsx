"use client";

import { NumberInput } from "@/components/number-input";
import { Input } from "@/components/ui/input";
import { kvInput, kvLabel } from "@/features/sales/customer-ui-primitives";
import { usePartnerOptions } from "./delivery-queries";
import { FEE_PAYERS } from "./delivery-types";

/** Thông tin giao của vận đơn (dùng cho "Sửa vận đơn" và "Tạo vận đơn" từ chi tiết hóa đơn). */
export type DeliveryForm = {
  partnerId: string; receiverName: string; receiverPhone: string; receiverAddress: string; area: string; weightGram: number;
  shippingFee: number; feePayer: "SHOP" | "CUSTOMER"; note: string;
};

/** Ô nhập người nhận, địa chỉ, đối tác (chỉ đối tác đang hoạt động + đối tác đang chọn), trọng lượng, phí, người trả phí. */
export function ShipmentDeliveryFields({ v, set }: { v: DeliveryForm; set: (p: Partial<DeliveryForm>) => void }) {
  const { data: partners = [] } = usePartnerOptions();
  const text = (key: "receiverName" | "receiverPhone" | "receiverAddress" | "area" | "note", label: string, required = false) => (
    <label className="block space-y-1"><span className={kvLabel}>{label}{required && " *"}</span>
      <Input required={required} className={kvInput} value={v[key]} onChange={(e) => set({ [key]: e.target.value })} /></label>
  );
  return (
    <>
      {text("receiverName", "Tên người nhận", true)}{text("receiverPhone", "Số điện thoại", true)}
      <div className="col-span-2">{text("receiverAddress", "Địa chỉ", true)}</div>
      {text("area", "Khu vực")}
      <label className="block space-y-1"><span className={kvLabel}>Đối tác giao hàng *</span>
        <select required className={`${kvInput} w-full border px-2`} value={v.partnerId} onChange={(e) => set({ partnerId: e.target.value })}>
          {!v.partnerId && <option value="">-- Chọn đối tác --</option>}
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
    </>
  );
}
