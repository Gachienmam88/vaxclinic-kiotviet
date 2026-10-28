"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useVnAdmin } from "@/lib/vn-admin-data";
import { SearchableSelect } from "./searchable-select";

/** Địa chỉ 2 cấp sau sắp xếp ĐVHC 2025: lưu cả mã (tra cứu) và tên (hiển thị / in, dữ liệu cũ chỉ có tên). */
export type VnAddress = { address: string; provinceCode: string; provinceName: string; wardCode: string; wardName: string };

export const EMPTY_VN_ADDRESS: VnAddress = { address: "", provinceCode: "", provinceName: "", wardCode: "", wardName: "" };

type Row = (key: "address" | "province" | "ward", label: string, control: ReactNode) => ReactNode;

type Props = {
  value: VnAddress;
  onChange: (v: VnAddress) => void;
  /** Bỏ ô "Địa chỉ" (form tự vẽ ô đó). */
  hideAddress?: boolean;
  addressRequired?: boolean;
  labels?: Partial<Record<"address" | "province" | "ward", string>>;
  addressPlaceholder?: string;
  /** Kiểu ô nhập/ô chọn để khớp form đang dùng. */
  controlClassName?: string;
  fieldClassName?: string;
  addressFieldClassName?: string;
  labelClassName?: string;
  /** Tự vẽ 1 dòng (nhãn + ô) cho form có bố cục riêng; mặc định <label> dọc. */
  renderRow?: Row;
  idPrefix?: string;
};

/**
 * Bộ ô địa chỉ dùng chung: "Địa chỉ" (số nhà, đường) + "Khu vực" (Tỉnh/Thành phố) → "Phường/Xã" (lọc theo tỉnh, tìm không dấu).
 * Trả về các ô liền nhau (fragment) để form cha tự xếp lưới.
 */
export function VnAddressFields({ value, onChange, hideAddress, addressRequired, labels = {}, addressPlaceholder = "Số nhà, tên đường",
  controlClassName, fieldClassName = "grid gap-1", addressFieldClassName, labelClassName = "text-xs", renderRow, idPrefix = "addr" }: Props) {
  const data = useVnAdmin();
  const set = (patch: Partial<VnAddress>) => onChange({ ...value, ...patch });
  const row: Row = renderRow ?? ((key, label, control) => (
    <div key={key} className={cn(fieldClassName, key === "address" && addressFieldClassName)}>
      <label htmlFor={`${idPrefix}-${key}`} className={labelClassName}>{label}</label>{control}
    </div>));

  const province = row("province", labels.province ?? "Khu vực", (
    <SearchableSelect id={`${idPrefix}-province`} aria-label={labels.province ?? "Khu vực"} className={controlClassName}
      options={data?.provinces ?? []} value={value.provinceCode} fallbackLabel={value.provinceName}
      placeholder="Chọn Tỉnh/Thành phố" searchPlaceholder="Tìm Tỉnh/Thành phố"
      onChange={(p) => p?.code === value.provinceCode ? undefined
        : set({ provinceCode: p?.code ?? "", provinceName: p?.name ?? "", wardCode: "", wardName: "" })} />));

  const ward = row("ward", labels.ward ?? "Phường/Xã", (
    <SearchableSelect id={`${idPrefix}-ward`} aria-label={labels.ward ?? "Phường/Xã"} className={controlClassName}
      options={data && value.provinceCode ? data.wardsOf(value.provinceCode) : []} value={value.wardCode}
      fallbackLabel={value.wardName} disabled={!value.provinceCode && !value.wardName}
      placeholder={value.provinceCode ? "Chọn Phường/Xã" : "Chọn Tỉnh/Thành phố trước"} searchPlaceholder="Tìm Phường/Xã"
      onChange={(w) => set({ wardCode: w?.code ?? "", wardName: w?.name ?? "" })} />));

  const address = hideAddress ? null : row("address", labels.address ?? "Địa chỉ", (
    <input id={`${idPrefix}-address`} required={addressRequired} placeholder={addressPlaceholder} value={value.address}
      aria-label={labels.address ?? "Địa chỉ"} onChange={(e) => set({ address: e.target.value })}
      className={cn("h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring", controlClassName)} />));

  return <>{address}{province}{ward}</>;
}

/** Đọc địa chỉ từ bản ghi API (tên trường tùy nơi) → VnAddress. */
export function toVnAddress(address?: string | null, provinceCode?: string | null, provinceName?: string | null,
  wardCode?: string | null, wardName?: string | null): VnAddress {
  return { address: address ?? "", provinceCode: provinceCode ?? "", provinceName: provinceName ?? "",
    wardCode: wardCode ?? "", wardName: wardName ?? "" };
}
