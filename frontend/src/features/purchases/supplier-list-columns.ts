import { formatDate, formatMoney } from "@/lib/format";
import type { SupplierRow } from "./supplier-types";

export type SupplierColumn = {
  key: string; label: string; align?: "right"; value: (s: SupplierRow) => string | number | null; sum?: "debt" | "totalBuy";
  defaultVisible: boolean;
};

/** Cột danh sách NCC; mặc định giống KiotViet, các cột còn lại bật ở nút chọn cột. */
export const SUPPLIER_COLUMNS: SupplierColumn[] = [
  { key: "code", label: "Mã nhà cung cấp", value: (s) => s.code, defaultVisible: true },
  { key: "name", label: "Tên nhà cung cấp", value: (s) => s.name, defaultVisible: true },
  { key: "phone", label: "Điện thoại", value: (s) => s.phone, defaultVisible: true },
  { key: "email", label: "Email", value: (s) => s.email, defaultVisible: true },
  { key: "group", label: "Nhóm nhà cung cấp", value: (s) => s.groupName, defaultVisible: false },
  { key: "taxCode", label: "Mã số thuế", value: (s) => s.taxCode, defaultVisible: false },
  { key: "address", label: "Địa chỉ", value: (s) => [s.address, s.ward, s.province].filter(Boolean).join(", "), defaultVisible: false },
  { key: "createdAt", label: "Ngày tạo", value: (s) => formatDate(s.createdAt), defaultVisible: false },
  { key: "status", label: "Trạng thái", value: (s) => (s.active ? "Đang hoạt động" : "Ngừng hoạt động"), defaultVisible: false },
  { key: "debt", label: "Nợ cần trả hiện tại", align: "right", value: (s) => formatMoney(s.debt), sum: "debt", defaultVisible: true },
  { key: "totalBuy", label: "Tổng mua", align: "right", value: (s) => formatMoney(s.totalBuy), sum: "totalBuy", defaultVisible: true },
];

/** Dòng CSV đầy đủ (mọi cột, số không định dạng) cho "Xuất file". */
export const SUPPLIER_CSV_HEADER = ["Mã nhà cung cấp", "Tên nhà cung cấp", "Điện thoại", "Email", "Địa chỉ", "Khu vực", "Phường/Xã",
  "Nhóm nhà cung cấp", "Tên công ty", "Mã số thuế", "Số CCCD/CMND", "Ghi chú", "Nợ cần trả hiện tại", "Tổng mua", "Trạng thái"];
export const supplierCsvRow = (s: SupplierRow) => [s.code, s.name, s.phone, s.email, s.address, s.province, s.ward, s.groupName,
  s.companyName, s.taxCode, s.idNumber, s.note, s.debt, s.totalBuy, s.active ? "Đang hoạt động" : "Ngừng hoạt động"];
