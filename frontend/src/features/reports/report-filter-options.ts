"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useSalesChannels } from "@/features/delivery/delivery-queries";
import type { PriceBook } from "@/features/products/price-book-types";
import { addDays } from "@/features/dashboard/dashboard-date-utils";

/** Mã "Bảng giá chung" (hóa đơn không áp bảng giá) — khớp ReportFilter.GENERAL_PRICE_BOOK ở sales-service. */
export const GENERAL_PRICE_BOOK = "00000000-0000-0000-0000-000000000000";

/**
 * Lựa chọn bộ lọc Bảng giá: Bảng giá chung + bảng giá ở product-service. Người xem báo cáo không có quyền xem
 * hàng hóa → chỉ còn Bảng giá chung (hóa đơn vẫn lưu tên bảng giá nên báo cáo không phụ thuộc danh sách này).
 */
export function usePriceBookOptions(): [string, string][] {
  const { data = [] } = useQuery({ queryKey: ["price-books"], queryFn: () => api<PriceBook[]>("/price-books"), retry: false, staleTime: 60_000 });
  return [[GENERAL_PRICE_BOOK, "Bảng giá chung"], ...data.map((b) => [b.id, b.name] as [string, string])];
}

/** Lựa chọn bộ lọc Kênh bán (kể cả kênh đã ngừng hoạt động — giao dịch cũ vẫn lọc được). */
export function useChannelOptions(): [string, string][] {
  const { data = [] } = useSalesChannels(true);
  return data.length ? data.map((c) => [c.code, c.name]) : [["DIRECT", "Bán trực tiếp"]];
}

/** Mốc "Thời gian giao hàng" của báo cáo đặt hàng (theo ngày giao hẹn với khách, giờ máy). */
export const DELIVERY_PRESETS: [string, string][] = [["today", "Hôm nay"], ["tomorrow", "Ngày mai"], ["next7", "7 ngày tới"],
  ["thisMonth", "Tháng này"], ["overdue", "Đã quá hạn"]];

export function deliverySpan(preset: string, now = new Date()): { deliveryFrom?: string; deliveryTo?: string } {
  const d0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const iso = (d: Date) => d.toISOString();
  switch (preset) {
    case "today": return { deliveryFrom: iso(d0), deliveryTo: iso(addDays(d0, 1)) };
    case "tomorrow": return { deliveryFrom: iso(addDays(d0, 1)), deliveryTo: iso(addDays(d0, 2)) };
    case "next7": return { deliveryFrom: iso(d0), deliveryTo: iso(addDays(d0, 7)) };
    case "thisMonth": return { deliveryFrom: iso(new Date(now.getFullYear(), now.getMonth(), 1)), deliveryTo: iso(new Date(now.getFullYear(), now.getMonth() + 1, 1)) };
    case "overdue": return { deliveryTo: iso(now) };
    default: return {};
  }
}
