"use client";

import { useEffect, useState } from "react";

/**
 * Tùy chọn màn soạn phiếu nhập / trả hàng nhập (lưu localStorage theo trình duyệt, như KiotViet):
 * - cột hiển thị (tab "Hiển thị"), các công tắc tab "Khác" mà ứng dụng làm được, cài đặt in.
 */
export type EditorColumn = "code" | "unit" | "discount" | "vat" | "priceWithVat" | "amount";
export const EDITOR_COLUMNS: EditorColumn[] = ["code", "unit", "discount", "vat", "priceWithVat", "amount"];

export type EditorOptions = {
  hidden: EditorColumn[];
  editAmount: boolean; // Chỉnh sửa thành tiền (sửa thành tiền → tính lại đơn giá)
  discountPercent: boolean; // Giảm giá theo % (false = VND)
  defaultPayAll: boolean; // Mặc định trả nhà cung cấp = cần trả
  priceSetup: boolean; // Thiết lập giá: hiện nút nhãn giá trên dòng
};
export type PrintSettings = { auto: boolean; copies: number };

const OPT_KEY = "purchase-editor-options";
const PRINT_KEY = "purchase-editor-print";
const DEFAULT_OPTIONS: EditorOptions = { hidden: [], editAmount: false, discountPercent: false, defaultPayAll: false, priceSetup: false };
const DEFAULT_PRINT: PrintSettings = { auto: false, copies: 1 };

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function useStored<T>(key: string, fallback: T): [T, (v: T) => void] {
  const [value, setValue] = useState(fallback);
  useEffect(() => setValue(read(key, fallback)), [key]); // eslint-disable-line react-hooks/exhaustive-deps -- chỉ đọc 1 lần
  const save = (v: T) => {
    setValue(v);
    try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* trình duyệt chặn lưu: chỉ giữ trong phiên */ }
  };
  return [value, save];
}

export const useEditorOptions = () => useStored(OPT_KEY, DEFAULT_OPTIONS);
export const usePrintSettings = () => useStored(PRINT_KEY, DEFAULT_PRINT);
