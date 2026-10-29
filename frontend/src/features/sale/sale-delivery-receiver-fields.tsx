"use client";

import { useEffect, useState } from "react";
import { MapPin, Plus } from "lucide-react";
import { VnAddressFields } from "@/components/ui/vn-address-fields";
import { fromDeliveryAddress, toDeliveryAddress } from "@/features/delivery/delivery-address";
import type { ReceiverStats } from "@/features/delivery/delivery-types";
import { api } from "@/lib/api-client";
import { useT } from "@/lib/i18n";
import { saleNs } from "@/messages/sale";
import { lineField, type DeliverySet } from "./sale-delivery-draft";
import type { DeliveryDraft, SaleCustomer } from "./sale-types";

/** Tỷ lệ giao thành công của SĐT người nhận (server tính trên vận đơn đã kết thúc); mất mạng / SĐT ngắn → không hiện. */
function useReceiverStats(phone: string) {
  const [stats, setStats] = useState<ReceiverStats | null>(null);
  useEffect(() => {
    const p = phone.trim();
    if (p.length < 9) { setStats(null); return; }
    let alive = true;
    const t = setTimeout(() => {
      api<ReceiverStats>(`/shipments/receiver-stats?phone=${encodeURIComponent(p)}`)
        .then((s) => alive && setStats(s)).catch(() => alive && setStats(null));
    }, 400);
    return () => { alive = false; clearTimeout(t); };
  }, [phone]);
  return stats;
}

/**
 * Người nhận (ghim xanh lá): tên, SĐT + badge tỷ lệ giao thành công (cam, khi có dữ liệu), "+" = người nhận mới;
 * địa chỉ, Khu vực, Phường/Xã (ĐVHC 2 cấp). Chọn khách → tự điền tên / SĐT người nhận nếu còn trống.
 */
export function SaleDeliveryReceiverFields({ id, v, set, customer }: {
  id: string; v: DeliveryDraft; set: DeliverySet; customer: SaleCustomer | null;
}) {
  const t = useT(saleNs);
  const stats = useReceiverStats(v.receiverPhone);

  useEffect(() => {
    if (!customer || (v.receiverName && v.receiverPhone)) return;
    set({ receiverName: v.receiverName || customer.name, receiverPhone: v.receiverPhone || customer.phone || "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ điền khi đổi khách
  }, [customer?.id]);

  const clearReceiver = () => set({ receiverName: "", receiverPhone: "", receiverAddress: "", area: "", provinceCode: "", wardCode: "",
    provinceName: "", wardName: "" });

  return (
    <div className="relative">
      <div className="flex items-center gap-2.5">
        <MapPin className="size-[18px] shrink-0 fill-[#16a34a] text-white" aria-hidden />
        <input className={`${lineField} flex-1`} aria-label={t("delivery.receiverName")} placeholder={t("delivery.receiverName")}
          value={v.receiverName} onChange={(e) => set({ receiverName: e.target.value })} />
        <input className={`${lineField} w-[96px] shrink-0`} aria-label={t("delivery.receiverPhone")} placeholder={t("delivery.receiverPhone")}
          inputMode="tel" value={v.receiverPhone} onChange={(e) => set({ receiverPhone: e.target.value })} />
        {stats?.rate != null && (
          <span className="shrink-0 rounded bg-[#fff1e0] px-1.5 py-0.5 text-[11px] font-semibold text-[#f97316]"
            title={t("delivery.successRate", { rate: stats.rate, delivered: stats.delivered, finished: stats.finished })}>{stats.rate}%</span>)}
        <button type="button" className="shrink-0 text-[#6b7280] hover:text-primary" aria-label={t("delivery.newReceiver")}
          title={t("delivery.newReceiver")} onClick={clearReceiver}><Plus className="size-4" /></button>
      </div>
      <div className="space-y-1.5 pt-1.5 pl-7">
        <VnAddressFields idPrefix={`sale-delivery-${id}`} value={toDeliveryAddress(v)} onChange={(a) => set(fromDeliveryAddress(a))}
          labels={{ address: t("delivery.address"), province: t("delivery.area"), ward: t("delivery.ward") }}
          addressPlaceholder={t("delivery.address")} selectPlaceholders={{ province: t("delivery.area"), ward: t("delivery.ward") }}
          renderRow={(key, _label, control) => <div key={key}>{control}</div>}
          controlClassName={`${lineField} h-10 rounded-none shadow-none dark:bg-transparent`} />
      </div>
    </div>
  );
}
