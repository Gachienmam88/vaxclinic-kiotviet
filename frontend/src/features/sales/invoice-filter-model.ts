import { addDays } from "@/features/dashboard/dashboard-date-utils";
import { timeRange, type TimeValue } from "@/features/reports/report-time-presets";
import type { InvoiceState } from "./sales-types";

/**
 * Bộ lọc danh sách Hóa đơn (sidebar + tìm nâng cao) → tham số GET /invoices (sales-service InvoiceQuery.Filter).
 * Thời gian: "Toàn thời gian" | mốc có sẵn | Tùy chỉnh.
 */
export type InvoiceTime = { mode: "all" } | TimeValue;

export type InvoiceFilters = {
  time: InvoiceTime;
  /** NONE = Không giao hàng, DELIVERY = Giao hàng; chọn cả hai = không lọc. */
  deliveries: string[];
  states: InvoiceState[];
  /** NONE = Không trả hàng, HAS = Có trả hàng. */
  returnStates: string[];
  /** 1 trạng thái HĐĐT, hoặc nhiều trạng thái nối bằng dấu phẩy (link sâu ?einvoice=PUBLISHED,ACCEPTED). */
  einvoiceStatus: string; einvoiceNature: string;
  methods: string[]; createdBy: string; sellerId: string;
};

/** Ô tìm kiếm nâng cao (icon lọc cạnh ô "Theo mã hóa đơn"). */
export type InvoiceSearch = { q: string; customerQ: string; productQ: string; noteQ: string };

export const EMPTY_SEARCH: InvoiceSearch = { q: "", customerQ: "", productQ: "", noteQ: "" };

export const DEFAULT_FILTERS: InvoiceFilters = {
  time: { mode: "preset", preset: "thisMonth" }, deliveries: [], states: ["PROCESSING", "COMPLETED"],
  returnStates: ["NONE", "HAS"], einvoiceStatus: "", einvoiceNature: "", methods: [], createdBy: "", sellerId: "",
};

/** Mở từ link (?code= / ?id=): toàn thời gian, mọi trạng thái — chắc chắn thấy hóa đơn cần mở. */
export const DEEP_LINK_FILTERS: InvoiceFilters = {
  ...DEFAULT_FILTERS, time: { mode: "all" }, states: ["PROCESSING", "COMPLETED", "FAILED_DELIVERY", "CANCELLED"],
};

export const STATE_OPTIONS: readonly (readonly [InvoiceState, string])[] = [
  ["PROCESSING", "Đang xử lý"], ["COMPLETED", "Hoàn thành"], ["FAILED_DELIVERY", "Không giao được"], ["CANCELLED", "Đã hủy"],
];

export const STATE_TONE: Record<InvoiceState, "green" | "red" | "blue" | "gray"> = {
  PROCESSING: "blue", COMPLETED: "green", FAILED_DELIVERY: "gray", CANCELLED: "red",
};

export const stateLabel = (s: InvoiceState) => STATE_OPTIONS.find(([v]) => v === s)?.[1] ?? s;

/** Trạng thái hiển thị của 1 hóa đơn chi tiết — cùng quy tắc với InvoiceFilterSql.STATE (sales-service). */
export function invoiceState(status: string, shipmentStatus: string | null | undefined): InvoiceState {
  if (status === "CANCELLED") return "CANCELLED";
  if (shipmentStatus === "RETURNING" || shipmentStatus === "RETURNED") return "FAILED_DELIVERY";
  if (shipmentStatus === "PENDING" || shipmentStatus === "PICKING" || shipmentStatus === "DELIVERING") return "PROCESSING";
  return "COMPLETED";
}

export const NATURE_OPTIONS = [["ORIGINAL", "Gốc"], ["ADJUST", "Điều chỉnh"], ["REPLACE", "Thay thế"]] as const;

export function invoiceListParams(f: InvoiceFilters, s: InvoiceSearch, page: number, size: number, ids?: string[]) {
  const p = new URLSearchParams({ page: String(page), size: String(size) });
  if (f.time.mode === "preset" || (f.time.mode === "custom" && f.time.from && f.time.to)) {
    const r = timeRange(f.time);
    p.set("from", r.from.toISOString());
    p.set("to", addDays(r.to, 1).toISOString());
  } else if (f.time.mode === "custom") { // khoảng 1 đầu
    if (f.time.from) p.set("from", new Date(`${f.time.from}T00:00:00`).toISOString());
    if (f.time.to) p.set("to", addDays(new Date(`${f.time.to}T00:00:00`), 1).toISOString());
  }
  (Object.keys(s) as (keyof InvoiceSearch)[]).forEach((k) => { if (s[k].trim()) p.set(k, s[k].trim()); });
  f.states.forEach((v) => p.append("states", v));
  f.deliveries.forEach((v) => p.append("deliveries", v));
  f.returnStates.forEach((v) => p.append("returnStates", v));
  f.einvoiceStatus.split(",").filter(Boolean).forEach((v) => p.append("einvoiceStatuses", v));
  if (f.einvoiceNature) p.append("einvoiceNatures", f.einvoiceNature);
  f.methods.forEach((m) => p.append("paymentMethods", m));
  if (f.createdBy) p.set("createdBy", f.createdBy);
  if (f.sellerId) p.set("sellerId", f.sellerId);
  ids?.forEach((id) => p.append("ids", id));
  return p;
}
