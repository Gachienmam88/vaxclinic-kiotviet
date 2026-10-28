"use client";

import { useEffect } from "react";
import { Truck } from "lucide-react";
import { NumberInput } from "@/components/number-input";
import { VnAddressFields } from "@/components/ui/vn-address-fields";
import { fromDeliveryAddress, toDeliveryAddress } from "@/features/delivery/delivery-address";
import { FEE_PAYERS } from "@/features/delivery/delivery-types";
import { formatMoney } from "@/lib/format";
import type { DeliveryDraft, DraftInvoice } from "./sale-types";
import type { SaleLookups } from "./use-sale-lookups";

const EMPTY: DeliveryDraft = {
  partnerId: "", receiverName: "", receiverPhone: "", receiverAddress: "", area: "", weightGram: null, shippingFee: 0, feePayer: "SHOP", note: "",
};
const FIELD = "h-8 w-full rounded-md border border-[#d1d5db] bg-background px-2.5 text-[13px] outline-none focus-visible:border-primary";

/**
 * Khung "Bán giao hàng" dưới giỏ hàng (như KiotViet): người nhận, địa chỉ + Khu vực (Tỉnh/TP) → Phường/Xã (danh mục ĐVHC
 * tĩnh, cache offline), đối tác giao hàng, trọng lượng,
 * phí giao hàng + người trả phí, ghi chú. Chọn khách → tự điền tên / SĐT người nhận nếu còn trống.
 * Chưa tích hợp API hãng vận chuyển: vận đơn cập nhật trạng thái tay ở Quản lý giao hàng.
 */
export function SaleDeliveryForm({ draft, update, lookups, cod }: {
  draft: DraftInvoice; update: (patch: Partial<DraftInvoice>) => void; lookups: SaleLookups; cod: number;
}) {
  const v = draft.delivery ?? EMPTY;
  const set = (patch: Partial<DeliveryDraft>) => update({ delivery: { ...v, ...patch } });
  const customer = draft.customer;

  useEffect(() => {
    if (!customer || (v.receiverName && v.receiverPhone)) return;
    set({ receiverName: v.receiverName || customer.name, receiverPhone: v.receiverPhone || customer.phone || "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ điền khi đổi khách
  }, [customer?.id]);

  const input = (key: "receiverName" | "receiverPhone" | "note", label: string, className = "") => (
    <label className={`space-y-1 ${className}`}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <input className={FIELD} aria-label={label} value={v[key]} onChange={(e) => set({ [key]: e.target.value })} />
    </label>
  );

  return (
    <div className="space-y-2.5 rounded-lg bg-background px-4 py-3">
      <p className="flex items-center gap-2 font-semibold text-primary"><Truck className="size-4" /> Thông tin giao hàng</p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 xl:grid-cols-4">
        {input("receiverName", "Tên người nhận *")}
        {input("receiverPhone", "Số điện thoại *")}
        <VnAddressFields idPrefix={`sale-delivery-${draft.id}`} value={toDeliveryAddress(v)} onChange={(a) => set(fromDeliveryAddress(a))}
          labels={{ address: "Địa chỉ *" }} fieldClassName="space-y-1" addressFieldClassName="col-span-2"
          labelClassName="block text-xs text-muted-foreground" controlClassName={FIELD} />
        <label className="col-span-2 space-y-1">
          <span className="text-xs text-muted-foreground">Đối tác giao hàng *</span>
          <select className={FIELD} aria-label="Đối tác giao hàng" value={v.partnerId} onChange={(e) => set({ partnerId: e.target.value })}>
            <option value="">{lookups.partners.length ? "Chọn đối tác giao hàng" : "Chưa có đối tác — thêm ở Đối tác giao hàng"}</option>
            {lookups.partners.map((p) => <option key={p.id} value={p.id}>{p.code} - {p.name}</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">Trọng lượng (gram)</span>
          <NumberInput aria-label="Trọng lượng (gram)" className={FIELD} value={v.weightGram ?? 0}
            onValueChange={(n) => set({ weightGram: n > 0 ? Math.round(n) : null })} />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">Phí giao hàng</span>
          <NumberInput aria-label="Phí giao hàng" className={FIELD} value={v.shippingFee} onValueChange={(shippingFee) => set({ shippingFee })} />
        </label>
        <div className="col-span-2 flex items-center gap-4 pt-1" role="radiogroup" aria-label="Người trả phí giao hàng">
          {FEE_PAYERS.map(([k, label]) => (
            <label key={k} className="flex cursor-pointer items-center gap-1.5">
              <input type="radio" name={`fee-payer-${draft.id}`} className="size-4 accent-primary" checked={v.feePayer === k}
                onChange={() => set({ feePayer: k })} />{label}
            </label>))}
        </div>
        <p className="col-span-2 self-center text-right font-semibold">Thu hộ (COD): <span className="text-primary">{formatMoney(cod)}</span></p>
        {input("note", "Ghi chú giao hàng", "col-span-2 xl:col-span-4")}
      </div>
    </div>
  );
}
