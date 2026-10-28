import type { VnAddress } from "@/components/ui/vn-address-fields";
import { joinAddress } from "@/lib/vn-admin-search";

/**
 * Khu vực giao hàng: area = "Phường/Xã, Tỉnh/Thành phố" (tên ghép, lưu như trước để hiển thị / lọc / in)
 * + mã ĐVHC (lọc theo tỉnh). Vận đơn cũ chỉ có area tự do, không có mã.
 */
export type DeliveryAreaFields = {
  receiverAddress: string; area: string;
  provinceCode?: string; wardCode?: string; provinceName?: string; wardName?: string;
};

/** Vận đơn đã lưu → tách tên tỉnh / phường từ area (ta tự ghép "phường, tỉnh" khi có mã). */
export function areaFromServer(s: { area: string | null; provinceCode?: string | null; wardCode?: string | null }) {
  const area = s.area ?? "";
  if (!s.provinceCode) return { area, provinceCode: "", wardCode: "", provinceName: "", wardName: "" };
  const parts = area.split(", ");
  return {
    area, provinceCode: s.provinceCode, wardCode: s.wardCode ?? "",
    provinceName: parts[parts.length - 1] ?? "", wardName: s.wardCode ? parts.slice(0, -1).join(", ") : "",
  };
}

/** Giá trị cho VnAddressFields; dữ liệu cũ không có mã → hiện area làm tên khu vực. */
export function toDeliveryAddress(v: DeliveryAreaFields): VnAddress {
  return {
    address: v.receiverAddress, provinceCode: v.provinceCode ?? "", wardCode: v.wardCode ?? "",
    provinceName: v.provinceName || (v.provinceCode ? "" : v.area), wardName: v.wardName ?? "",
  };
}

/** VnAddressFields → các trường thông tin giao (ghép lại area). */
export function fromDeliveryAddress(a: VnAddress): Required<DeliveryAreaFields> {
  return {
    receiverAddress: a.address, provinceCode: a.provinceCode, wardCode: a.wardCode, provinceName: a.provinceName,
    wardName: a.wardName, area: joinAddress(a.wardName, a.provinceName),
  };
}
