"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, errorMessage, type PageResponse } from "@/lib/api-client";
import { useT } from "@/lib/i18n";
import { settingsNs } from "@/messages/settings";

/** Thiết lập cảnh báo Hộp thư đến (identity-service app_settings khóa "notification"). */
export type NotificationSettings = { expiryAlertDays: number };

/** Thông báo nội bộ (tab "Cập nhật" của Hộp thư đến) — khớp AnnouncementController.Announcement. */
export type Announcement = {
  id: number; title: string; body: string | null; link: string | null; createdByName: string | null;
  createdAt: string; updatedAt: string;
};

export type AnnouncementInput = { title: string; body: string; link: string };

const ANN_KEY = ["announcements"] as const;

export function useNotificationSettings() {
  return useQuery({ queryKey: ["notification-settings"], queryFn: () => api<NotificationSettings>("/notifications/settings") });
}

export function useSaveNotificationSettings() {
  const qc = useQueryClient();
  const t = useT(settingsNs);
  return useMutation({
    mutationFn: (body: NotificationSettings) => api<NotificationSettings>("/notifications/settings", { method: "PUT", body }),
    onSuccess: (data) => { qc.setQueryData(["notification-settings"], data); toast.success(t("common.updated")); },
    onError: (e) => toast.error(errorMessage(e)),
  });
}

export function useAnnouncements(page: number, size: number) {
  return useQuery({
    queryKey: [...ANN_KEY, page, size],
    queryFn: () => api<PageResponse<Announcement>>(`/announcements?page=${page}&size=${size}`),
  });
}

/** Tạo (id undefined) / sửa thông báo; xong làm mới danh sách và hộp thư. */
export function useSaveAnnouncement(id: number | undefined, onDone: () => void) {
  const qc = useQueryClient();
  const t = useT(settingsNs);
  return useMutation({
    mutationFn: (body: AnnouncementInput) =>
      api<Announcement>(id ? `/announcements/${id}` : "/announcements", { method: id ? "PUT" : "POST", body }),
    onSuccess: () => {
      toast.success(id ? t("notifications.updated") : t("notifications.sent"));
      qc.invalidateQueries({ queryKey: ANN_KEY });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      onDone();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}

export function useDeleteAnnouncement() {
  const qc = useQueryClient();
  const t = useT(settingsNs);
  return useMutation({
    mutationFn: (id: number) => api(`/announcements/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success(t("notifications.deleted"));
      qc.invalidateQueries({ queryKey: ANN_KEY });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}
