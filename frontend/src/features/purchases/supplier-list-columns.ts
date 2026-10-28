import type { MessageKey, TFunction } from "@/lib/i18n";
import { formatDate, formatMoney } from "@/lib/format";
import type { commonNs } from "@/messages/common";
import type { purchasesNs } from "@/messages/purchases";
import type { SupplierRow } from "./supplier-types";

type CommonT = TFunction<(typeof commonNs)["vi"]>;
/** Nhãn cột = khóa của namespace "purchases" (p) hoặc "common" (c), dịch lúc render. */
export type ColumnLabel = { p: MessageKey<(typeof purchasesNs)["vi"]> } | { c: MessageKey<(typeof commonNs)["vi"]> };

export type SupplierColumn = {
  key: string; label: ColumnLabel; align?: "right"; value: (s: SupplierRow, tc: CommonT) => string | number | null;
  sum?: "debt" | "totalBuy"; defaultVisible: boolean;
};

/** Cột danh sách NCC; mặc định giống KiotViet, các cột còn lại bật ở nút chọn cột. */
export const SUPPLIER_COLUMNS: SupplierColumn[] = [
  { key: "code", label: { p: "suppliers.cols.code" }, value: (s) => s.code, defaultVisible: true },
  { key: "name", label: { p: "suppliers.cols.name" }, value: (s) => s.name, defaultVisible: true },
  { key: "phone", label: { c: "fields.phone" }, value: (s) => s.phone, defaultVisible: true },
  { key: "email", label: { c: "fields.email" }, value: (s) => s.email, defaultVisible: true },
  { key: "group", label: { p: "suppliers.cols.group" }, value: (s) => s.groupName, defaultVisible: false },
  { key: "taxCode", label: { p: "suppliers.cols.taxCode" }, value: (s) => s.taxCode, defaultVisible: false },
  { key: "address", label: { c: "fields.address" }, value: (s) => [s.address, s.ward, s.province].filter(Boolean).join(", "), defaultVisible: false },
  { key: "createdAt", label: { c: "fields.createdAt" }, value: (s) => formatDate(s.createdAt), defaultVisible: false },
  { key: "status", label: { c: "fields.status" }, value: (s, tc) => tc(s.active ? "status.active" : "status.inactive"), defaultVisible: false },
  { key: "debt", label: { p: "suppliers.cols.debt" }, align: "right", value: (s) => formatMoney(s.debt), sum: "debt", defaultVisible: true },
  { key: "totalBuy", label: { p: "suppliers.cols.totalBuy" }, align: "right", value: (s) => formatMoney(s.totalBuy), sum: "totalBuy", defaultVisible: true },
];

/** Dịch nhãn cột với 2 hàm dịch (purchases, common). */
export const columnLabel = (l: ColumnLabel, t: TFunction<(typeof purchasesNs)["vi"]>, tc: CommonT) => ("p" in l ? t(l.p) : tc(l.c));

/**
 * Dòng CSV đầy đủ (mọi cột, số không định dạng) cho "Xuất file". Tiêu đề + giá trị giữ tiếng Việt ở mọi ngôn ngữ:
 * cùng bộ cột với file import (SupplierImportService đọc theo tiêu đề tiếng Việt) để xuất ra sửa rồi nhập lại được.
 */
export const SUPPLIER_CSV_HEADER = ["Mã nhà cung cấp", "Tên nhà cung cấp", "Điện thoại", "Email", "Địa chỉ", "Khu vực", "Phường/Xã",
  "Nhóm nhà cung cấp", "Tên công ty", "Mã số thuế", "Số CCCD/CMND", "Ghi chú", "Nợ cần trả hiện tại", "Tổng mua", "Trạng thái"];
export const supplierCsvRow = (s: SupplierRow) => [s.code, s.name, s.phone, s.email, s.address, s.province, s.ward, s.groupName,
  s.companyName, s.taxCode, s.idNumber, s.note, s.debt, s.totalBuy, s.active ? "Đang hoạt động" : "Ngừng hoạt động"];
