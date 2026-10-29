"use client";

import { DateTimePicker } from "@/components/ui/date-time-picker";
import { VnAddressFields, type VnAddress } from "@/components/ui/vn-address-fields";
import { useSalesChannels } from "@/features/delivery/delivery-queries";
import { useUserLookup } from "@/features/purchases/purchase-queries";
import { toLocalDateTime } from "@/lib/date-input-format";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ordersNs } from "@/messages/orders";
import { ORDER_STATUS_KEY, type Order } from "./order-types";

/** Phần sửa được của chi tiết đơn (gửi PATCH /orders/{id}/info khi bấm Lưu). Giờ dạng "yyyy-MM-ddTHH:mm" địa phương. */
export type OrderInfoDraft = { sellerId: string; orderedAt: string; salesChannel: string; expectedDeliveryAt: string;
  status: "DRAFT" | "CONFIRMED" | null; note: string; area: VnAddress };

export const orderInfoDraft = (o: Order): OrderInfoDraft => ({
  sellerId: o.sellerId ?? "", orderedAt: toLocalDateTime(o.orderedAt) ?? "", salesChannel: o.salesChannel,
  expectedDeliveryAt: toLocalDateTime(o.expectedDeliveryAt) ?? "", note: o.note ?? "",
  status: o.status === "DRAFT" || o.status === "CONFIRMED" ? o.status : null,
  area: { address: "", provinceCode: o.area?.provinceCode ?? "", provinceName: o.area?.province ?? "", wardCode: o.area?.wardCode ?? "",
    wardName: o.area?.ward ?? "" },
});

const FIELD = "h-[30px] w-full min-w-0 border-0 border-b border-[#c8ccd2] bg-transparent text-[13px] outline-none focus:border-primary disabled:border-transparent";
const ROW = "grid grid-cols-[110px_1fr] items-center gap-2";

/**
 * Lưới thông tin như KiotViet: Người tạo, Người nhận đặt, Ngày đặt, Kênh bán, Bảng giá, Dự kiến giao, Trạng thái
 * (Phiếu tạm / Đã xác nhận khi đơn còn mở), Khu vực giao hàng (Tỉnh/Thành → Phường/Xã). Đơn đã hủy chỉ xem.
 */
export function OrderDetailInfoFields({ order, value, onChange, editable }: {
  order: Order; value: OrderInfoDraft; onChange: (v: OrderInfoDraft) => void; editable: boolean;
}) {
  const t = useT(ordersNs);
  const { data: users = [] } = useUserLookup();
  const { data: channels = [] } = useSalesChannels();
  const set = (p: Partial<OrderInfoDraft>) => onChange({ ...value, ...p });
  const row = (label: string, body: React.ReactNode) => <div className={ROW}><span className="text-muted-foreground">{label}</span>{body}</div>;
  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-1.5 text-[13px] md:grid-cols-3">
      {row(t("kv.detail.createdBy"), <span className="h-[30px] leading-[30px]">{order.createdByName}</span>)}
      {row(t("kv.detail.seller"), <select className={FIELD} aria-label={t("kv.detail.seller")} disabled={!editable} value={value.sellerId}
        onChange={(e) => set({ sellerId: e.target.value })}>
        {!value.sellerId && <option value="">{order.sellerName ?? "—"}</option>}
        {users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}</select>)}
      {row(t("kv.detail.orderedAt"), <DateTimePicker className={FIELD} aria-label={t("kv.detail.orderedAt")} disabled={!editable}
        value={value.orderedAt} onChange={(orderedAt) => orderedAt && set({ orderedAt })} />)}
      {row(t("kv.detail.channel"), <select className={FIELD} aria-label={t("kv.detail.channel")} disabled={!editable} value={value.salesChannel}
        onChange={(e) => set({ salesChannel: e.target.value })}>
        {!channels.some((c) => c.code === value.salesChannel) && <option value={value.salesChannel}>{value.salesChannel}</option>}
        {channels.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</select>)}
      {row(t("kv.detail.priceBook"), <span className="h-[30px] leading-[30px]">{order.priceBookName ?? t("kv.detail.defaultPriceBook")}</span>)}
      {row(t("kv.detail.expected"), <DateTimePicker className={FIELD} aria-label={t("kv.detail.expected")} disabled={!editable}
        value={value.expectedDeliveryAt} onChange={(expectedDeliveryAt) => set({ expectedDeliveryAt })} />)}
      {value.status && row(t("kv.detail.status"), <select className={cn(FIELD, "font-medium")} aria-label={t("kv.detail.status")}
        disabled={!editable} value={value.status} onChange={(e) => set({ status: e.target.value as "DRAFT" | "CONFIRMED" })}>
        {(["DRAFT", "CONFIRMED"] as const).map((s) => <option key={s} value={s}>{t(ORDER_STATUS_KEY[s])}</option>)}</select>)}
      {editable ? <VnAddressFields hideAddress idPrefix={`order-${order.id}`} controlClassName={FIELD} value={value.area}
        labels={{ province: t("kv.area"), ward: t("kv.ward") }} onChange={(area) => set({ area })}
        renderRow={(key, label, control) => <div key={key} className={ROW}><span className="text-muted-foreground">{label}</span>{control}</div>} />
        : row(t("kv.area"), <span className="h-[30px] leading-[30px]">{[value.area.wardName, value.area.provinceName].filter(Boolean).join(", ")}</span>)}
    </div>
  );
}
