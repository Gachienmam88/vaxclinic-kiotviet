import type { DeliveryDraft, DraftInvoice } from "./sale-types";

/** Thông tin giao mặc định của tab Bán giao hàng (như KiotViet: 1 kiện 500 gram, 10×10×10 cm, Giao thường, Chờ xử lý, bật thu hộ). */
export const EMPTY_DELIVERY: DeliveryDraft = {
  partnerId: "", receiverName: "", receiverPhone: "", receiverAddress: "", area: "", weightGram: 500, shippingFee: 0, feePayer: "SHOP",
  note: "", serviceType: "STANDARD", waybillCode: "", expectedDeliveryAt: "", status: "PENDING", packageCount: 1, lengthCm: 10,
  widthCm: 10, heightCm: 10, weightUnit: "g", codEnabled: true,
};

/** Thông tin giao của tab (tab lưu từ bản cũ thiếu trường mới → lấy mặc định). */
export const deliveryOf = (d: DraftInvoice): DeliveryDraft => ({ ...EMPTY_DELIVERY, ...d.delivery });

export type DeliverySet = (patch: Partial<DeliveryDraft>) => void;

/** Hàm sửa thông tin giao của tab đang mở. */
export const deliverySetter = (d: DraftInvoice, update: (p: Partial<DraftInvoice>) => void): DeliverySet =>
  (patch) => update({ delivery: { ...deliveryOf(d), ...patch } });

/** Ô nhập gạch chân của khung giao hàng (như KiotViet). */
export const lineField =
  "h-8 w-full min-w-0 border-0 border-b border-[#c8ccd2] bg-transparent px-0 text-[13px] outline-none placeholder:text-[#9ca3af] focus:border-primary disabled:opacity-60 rounded-none shadow-none focus-visible:border-primary focus-visible:ring-0 dark:bg-transparent";
