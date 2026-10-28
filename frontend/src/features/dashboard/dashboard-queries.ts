"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import type { DailyRevenue } from "@/features/accounting/tax-calc";
import type { ProductDetail } from "@/features/products/product-types";
import type { InvoiceList } from "@/features/sales/sales-types";
import { api, type PageResponse } from "@/lib/api-client";
import { instantRange, ymd } from "./dashboard-date-utils";

export type AuditLog = {
  id: number; occurredAt: string; userName: string | null; feature: string; action: string; docCode: string | null; detail: string | null;
};

/** Doanh thu theo ngày × mặt hàng (đã phân bổ giảm giá hóa đơn), mọi chi nhánh người dùng được xem. */
export function useDailyRevenue(from: Date, to: Date, enabled: boolean) {
  const range = `from=${ymd(from)}&to=${ymd(to)}`;
  return useQuery({
    queryKey: ["revenue-daily", range], enabled, staleTime: 60_000,
    queryFn: () => api<DailyRevenue[]>(`/accounting/revenue/daily?${range}`),
  });
}

/** Số hóa đơn hoàn thành trong khoảng ngày (chỉ lấy tổng, size=1). */
export function useInvoiceCount(from: Date, to: Date, enabled: boolean) {
  const r = instantRange(from, to);
  const params = new URLSearchParams({ from: r.from, to: r.to, statuses: "COMPLETED", size: "1" });
  return useQuery({
    queryKey: ["invoices", params.toString()], enabled, staleTime: 60_000,
    queryFn: () => api<InvoiceList>(`/invoices?${params}`),
    select: (d) => d.total,
  });
}

/** Tối đa số trang hóa đơn (100/trang) tải để vẽ "Theo giờ"; vượt quá thì yêu cầu chọn khoảng ngắn hơn. */
export const HOURLY_MAX_PAGES = 20;

/** Doanh thu hóa đơn (chưa trừ trả hàng) theo giờ 0–23; null nếu quá nhiều hóa đơn. */
export function useHourlyRevenue(from: Date, to: Date, enabled: boolean) {
  const r = instantRange(from, to);
  return useQuery({
    queryKey: ["dashboard-hourly", r.from, r.to], enabled, staleTime: 60_000,
    queryFn: async () => {
      const hours = Array<number>(24).fill(0);
      for (let page = 0; ; page++) {
        const params = new URLSearchParams({ from: r.from, to: r.to, statuses: "COMPLETED", size: "100", page: String(page) });
        const d = await api<InvoiceList>(`/invoices?${params}`);
        if (page === 0 && d.total > HOURLY_MAX_PAGES * 100) return null;
        d.items.forEach((i) => { hours[new Date(i.soldAt).getHours()] += Number(i.total); });
        if ((page + 1) * 100 >= d.total || !d.items.length) return hours;
      }
    },
  });
}

/** 10 thao tác gần nhất (cần quyền user.manage). */
export function useRecentActivities(enabled: boolean) {
  return useQuery({
    queryKey: ["audit-logs", "dashboard"], enabled, refetchInterval: 60_000,
    queryFn: () => api<PageResponse<AuditLog>>("/audit-logs?size=10"),
    select: (d) => d.items,
  });
}

/** Tên hàng hóa theo id (dùng chung cache ["product", id] với màn chi tiết hàng hóa). */
export function useProductNames(ids: string[]) {
  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: ["product", id], staleTime: 5 * 60_000,
      queryFn: () => api<ProductDetail>(`/products/${id}`),
    })),
  });
  return new Map(ids.map((id, i) => [id, results[i]?.data?.name]));
}
