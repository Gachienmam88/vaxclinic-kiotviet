"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type PageResponse } from "@/lib/api-client";
import { docCodeHref } from "@/components/ui/doc-code-link";

/** Tab của Hộp thư đến: Tất cả / Cảnh báo (tự sinh) / Cập nhật (thông báo nội bộ). */
export type InboxTab = "all" | "alert" | "update";

/** Khớp NotificationReader.NotificationItem (identity-service). branchName null = mọi chi nhánh. */
export type InboxItem = {
  id: number; category: "ALERT" | "UPDATE"; type: string; title: string; body: string | null;
  docCode: string | null; link: string | null; branchId: string | null; branchName: string | null;
  createdByName: string | null; createdAt: string; read: boolean;
};

export type UnreadCount = { count: number; alert: number; update: number };

const PAGE_SIZE = 20;
const KEY = ["notifications"] as const;

/** Số chưa đọc — hỏi lại mỗi 30 giây; TanStack Query tự dừng hỏi khi tab trình duyệt bị ẩn. */
export function useUnreadCount() {
  return useQuery({
    queryKey: [...KEY, "unread"],
    queryFn: () => api<UnreadCount>("/notifications/unread-count"),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    staleTime: 20_000,
  });
}

/** Danh sách theo tab, tải thêm từng trang 20 dòng khi cuộn tới cuối. Chỉ chạy khi panel đang mở. */
export function useInbox(tab: InboxTab, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: [...KEY, "list", tab],
    queryFn: ({ pageParam }) => api<PageResponse<InboxItem>>(`/notifications?tab=${tab}&page=${pageParam}&size=${PAGE_SIZE}`),
    initialPageParam: 0,
    getNextPageParam: (last) => ((last.page + 1) * last.size < last.total ? last.page + 1 : undefined),
    enabled,
    staleTime: 0,
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api(`/notifications/${id}/read`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api("/notifications/read-all", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

/** Đường dẫn khi bấm dòng: link cụ thể, nếu không thì trang của mã hàng / chứng từ (docCodeHref). */
export function inboxItemHref(item: InboxItem): string | null {
  return item.link ?? (item.docCode ? docCodeHref(item.docCode) : null);
}

/** "15:00 26/10/2026" như KiotViet. */
export function formatInboxTime(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())} ${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}
