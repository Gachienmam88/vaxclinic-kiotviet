"use client";

import { ProductFilterMultiSelect } from "./product-filter-multi-select";
import { useT } from "@/lib/i18n";
import { productsNs } from "@/messages/products";

type Props = {
  title: string;
  /** Nhãn radio "tất cả" (VD Toàn hệ thống / Tất cả) và "cụ thể" (VD Chi nhánh cụ thể). */
  allLabel: string;
  specificLabel: string;
  placeholder: string;
  /** null = tất cả */
  value: string[] | null;
  onChange: (v: string[] | null) => void;
  options: { id: string; name: string }[];
  isLoading?: boolean;
  /** Lỗi tải danh sách → khóa lựa chọn "cụ thể" và hiển thị lỗi (không dùng dữ liệu giả). */
  error?: string | null;
};

/** Thẻ phạm vi áp dụng của bảng giá (tab "Phạm vi áp dụng"): radio tất cả / cụ thể, "cụ thể" mở ô chọn nhiều. */
export function PriceBookScopePicker({ title, allLabel, specificLabel, placeholder, value, onChange, options, isLoading, error }: Props) {
  const name = `scope-${title}`;
  const disabled = !!error || isLoading;
  const t = useT(productsNs);
  return (
    <section className="space-y-3 rounded-lg border border-[#e5e7eb] p-3 text-[13px]">
      <h3 className="font-bold">{title}</h3>
      <label className="flex cursor-pointer items-center gap-2">
        <input type="radio" name={name} className="size-4 accent-primary" checked={value == null} onChange={() => onChange(null)} />
        {allLabel}
      </label>
      <label className="flex cursor-pointer items-center gap-2">
        <input type="radio" name={name} className="size-4 accent-primary" checked={value != null} disabled={disabled}
          onChange={() => onChange([])} />
        {specificLabel}
      </label>
      {value != null && !disabled && (
        <div className="pl-6"><ProductFilterMultiSelect placeholder={placeholder} options={options} value={value} onChange={onChange} /></div>
      )}
      {isLoading && <p className="text-xs text-muted-foreground">{t("scope.loading")}</p>}
      {error && <p className="text-xs text-destructive">{t("scope.loadError", { what: title.toLowerCase(), error })}</p>}
    </section>
  );
}
