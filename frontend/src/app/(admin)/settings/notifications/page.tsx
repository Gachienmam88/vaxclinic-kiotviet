"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListEmptyRow } from "@/components/ui/list-empty-state";
import { AnnouncementFormDialog } from "@/features/settings/announcement-form-dialog";
import {
  useAnnouncements, useDeleteAnnouncement, useNotificationSettings, useSaveNotificationSettings, type Announcement,
} from "@/features/settings/notification-settings-queries";
import { SETTINGS_TABLE as T, SettingRow, SettingsCard, SettingsPage } from "@/features/settings/settings-shell";
import { formatDateTime } from "@/lib/format";
import { useCurrentUser } from "@/lib/use-current-user";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { settingsNs } from "@/messages/settings";

const PAGE = 20;

/** Số ngày báo trước lô sắp hết hạn: lưu khi rời ô / Enter (1–365). */
function ExpiryDaysInput({ value, disabled, onSave }: { value: number; disabled: boolean; onSave: (v: number) => void }) {
  const t = useT(settingsNs);
  const [text, setText] = useState<string | null>(null);
  const commit = () => {
    if (text == null) return;
    const n = Number(text);
    setText(null);
    if (Number.isInteger(n) && n >= 1 && n <= 365 && n !== value) onSave(n);
  };
  return (
    <span className="flex items-center gap-2 text-[13px]">
      <Input aria-label={t("notifications.expiryDaysLabel")} inputMode="numeric" className="h-8 w-20 text-right" disabled={disabled}
        value={text ?? String(value)} onChange={(e) => setText(e.target.value.replace(/\D/g, "").slice(0, 3))}
        onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") commit(); }} />
      {t("notifications.days")}
    </span>
  );
}

/**
 * Thiết lập → Thông báo nội bộ: (1) cảnh báo tự động của Hộp thư đến (số ngày báo trước lô hết hạn);
 * (2) viết thông báo gửi tới mọi người dùng (tab "Cập nhật"). Cần quyền settings.manage.
 */
export default function NotificationSettingsPage() {
  const { can } = useCurrentUser();
  const t = useT(settingsNs);
  const tc = useT(commonNs);
  const manage = can("settings.manage");
  const { data: settings } = useNotificationSettings();
  const saveSettings = useSaveNotificationSettings();
  const [page, setPage] = useState(0);
  const { data } = useAnnouncements(page, PAGE);
  const remove = useDeleteAnnouncement();
  const [editing, setEditing] = useState<Announcement | "new" | null>(null);
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE)) : 1;

  return (
    <SettingsPage toc={[{ id: "alerts", label: t("notifications.tocAlerts") }, { id: "announcements", label: t("notifications.tocAnnouncements") }]}>
      <SettingsCard id="alerts" title={t("notifications.tocAlerts")}
        description={t("notifications.alertsDesc")}>
        <SettingRow title={t("notifications.expiry")}
          description={t("notifications.expiryDesc")}
          control={settings && <ExpiryDaysInput value={settings.expiryAlertDays} disabled={!manage || saveSettings.isPending}
            onSave={(v) => saveSettings.mutate({ expiryAlertDays: v })} />} />
        <SettingRow title={t("notifications.otherAlerts")}
          description={t("notifications.otherAlertsDesc")} />
      </SettingsCard>

      <SettingsCard id="announcements" title={t("notifications.tocAnnouncements")}
        description={t("notifications.announcementsDesc")}
        action={manage && <Button size="sm" onClick={() => setEditing("new")}><Plus className="size-4" /> {t("notifications.create")}</Button>}>
        <div className="p-4">
          <table className={T.table}>
            <thead className={T.head}><tr>
              <th>{t("notifications.colTitle")}</th><th className="w-40">{t("notifications.colCreatedBy")}</th><th className="w-36">{t("notifications.colTime")}</th><th className="w-20" />
            </tr></thead>
            <tbody>
              {data && !data.items.length && <ListEmptyRow cols={4} what={t("notifications.emptyWhat")} compact />}
              {data?.items.map((a) => (
                <tr key={a.id} className={T.row}>
                  <td>
                    <p className="font-medium">{a.title}</p>
                    {a.body && <p className="mt-0.5 line-clamp-2 text-muted-foreground">{a.body}</p>}
                  </td>
                  <td>{a.createdByName}</td>
                  <td>{formatDateTime(a.createdAt)}</td>
                  <td className="text-right whitespace-nowrap">
                    {manage && (
                      <>
                        <Button variant="ghost" size="icon-sm" aria-label={tc("actions.edit")} title={tc("actions.edit")} onClick={() => setEditing(a)}>
                          <Pencil />
                        </Button>
                        <Button variant="ghost" size="icon-sm" aria-label={tc("actions.delete")} title={tc("actions.delete")} disabled={remove.isPending}
                          onClick={() => { if (window.confirm(t("notifications.confirmDelete", { title: a.title }))) remove.mutate(a.id); }}>
                          <Trash2 />
                        </Button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pages > 1 && (
            <div className="mt-3 flex items-center justify-end gap-2 text-[13px]">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>{t("common.prev")}</Button>
              <span>{t("common.pageOf", { page: page + 1, pages })}</span>
              <Button variant="outline" size="sm" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>{t("common.next")}</Button>
            </div>
          )}
        </div>
      </SettingsCard>

      {editing && (
        <AnnouncementFormDialog open onOpenChange={(o) => { if (!o) setEditing(null); }}
          announcement={editing === "new" ? undefined : editing} />
      )}
    </SettingsPage>
  );
}
