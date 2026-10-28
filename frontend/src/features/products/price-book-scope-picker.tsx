"use client";

import { Label } from "@/components/ui/label";
import { ProductFilterMultiSelect } from "./product-filter-multi-select";

type Props = {
  label: string;
  placeholder: string;
  /** null = tất cả */
  value: string[] | null;
  onChange: (v: string[] | null) => void;
  options: { id: string; name: string }[];
  isLoading?: boolean;
  /** Lỗi tải danh sách → khóa ô chọn và hiển thị lỗi (không dùng dữ liệu giả). */
  error?: string | null;
};

/** Phạm vi áp dụng của bảng giá: "Tất cả" hoặc "Chọn" + danh sách chọn nhiều. */
export function PriceBookScopePicker({ label, placeholder, value, onChange, options, isLoading, error }: Props) {
  const name = `scope-${label}`;
  const disabled = !!error || isLoading;
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-4 text-[13px]">
        <label className="flex items-center gap-1.5">
          <input type="radio" name={name} className="size-4 accent-primary" checked={value == null} onChange={() => onChange(null)} />
          Tất cả
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" name={name} className="size-4 accent-primary" checked={value != null} disabled={disabled}
            onChange={() => onChange([])} />
          Chọn
        </label>
      </div>
      {value != null && !disabled && (
        <ProductFilterMultiSelect placeholder={placeholder} options={options} value={value} onChange={onChange} />
      )}
      {isLoading && <p className="text-xs text-muted-foreground">Đang tải danh sách...</p>}
      {error && <p className="text-xs text-destructive">Không tải được danh sách {label.toLowerCase()}: {error}</p>}
    </div>
  );
}
