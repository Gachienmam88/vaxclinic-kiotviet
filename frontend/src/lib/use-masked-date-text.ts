"use client";

import { useState } from "react";
import { applyMask } from "./date-input-format";

type Options = {
  /** Giá trị hiện tại theo định dạng gốc ("yyyy-MM-dd" / "yyyy-MM-ddTHH:mm" / "HH:mm"); rỗng = chưa chọn. */
  value: string | null | undefined;
  onChange: (value: string) => void;
  mask: string;
  /** Giá trị → chuỗi hiển thị ("" khi rỗng/sai). */
  format: (value: string) => string;
  /** Chuỗi hiển thị → giá trị, sai → null. */
  parse: (text: string) => string | null;
  /** Ràng buộc thêm (min/max); trả false → coi như sai. */
  allowed?: (value: string) => boolean;
};

/**
 * Trạng thái chữ của ô nhập ngày/giờ có mặt nạ: gõ trực tiếp, hợp lệ mới báo onChange,
 * sai thì `invalid` (viền đỏ) và không lưu. Giá trị đổi từ ngoài vào sẽ ghi đè chữ đang hiển thị.
 */
export function useMaskedDateText({ value, onChange, mask, format, parse, allowed }: Options) {
  const current = value ?? "";
  const [text, setText] = useState(() => format(current));
  const [seen, setSeen] = useState(current);

  const toValue = (t: string): string | null => {
    if (t.trim() === "") return "";
    const v = parse(t);
    return v !== null && (!allowed || allowed(v)) ? v : null;
  };

  // Đồng bộ khi giá trị bị đổi từ ngoài (reset form, chọn mốc khác...) — mẫu "điều chỉnh state khi prop đổi" của React.
  if (current !== seen) {
    setSeen(current);
    if (toValue(text) !== current) setText(format(current));
  }

  const commit = (next: string) => {
    setSeen(next);
    setText(format(next));
    if (next !== current) onChange(next);
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const atEnd = (e.target.selectionStart ?? raw.length) >= raw.length;
    const next = atEnd ? applyMask(raw, mask) : raw.replace(/[^\d/: ]/g, "");
    setText(next);
    const v = toValue(next);
    if (v !== null && v !== current) { setSeen(v); onChange(v); }
  };

  /** Rời ô: chuẩn hóa "1/2/2026" → "01/02/2026" nếu hợp lệ; sai thì giữ nguyên để người dùng sửa. */
  const onBlur = () => {
    const v = toValue(text);
    if (v !== null) setText(format(v));
  };

  return { text, invalid: toValue(text) === null, commit, onInputChange, onBlur };
}
