"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SETTINGS_TABLE as T, SETTINGS_TABS } from "@/features/settings/settings-shell";
import { StoreInfoGeneralTab } from "@/features/store-profile/store-info-general-tab";
import { ProfileCard } from "@/features/store-profile/store-profile-shell";
import { useStoreHistory, useStoreProfile } from "@/features/store-profile/store-profile-queries";
import { errorMessage } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { storeProfileNs } from "@/messages/store-profile";

/** Tab "Lịch sử cập nhật": các thay đổi hồ sơ / gian hàng (Lịch sử thao tác tính năng "Hồ sơ cửa hàng"). */
function HistoryTab() {
  const [page, setPage] = useState(0);
  const { data } = useStoreHistory(page);
  const t = useT(storeProfileNs);
  const pages = data ? Math.ceil(data.total / data.size) : 0;
  return (
    <div className="px-5 py-4">
      <table className={T.table}>
        <thead className={T.head}><tr><th className="w-40">{t("info.history.time")}</th><th className="w-48">{t("info.history.user")}</th><th>{t("info.history.content")}</th></tr></thead>
        <tbody>
          {data?.items.map((h) => (
            <tr key={h.id} className={T.row}><td>{formatDateTime(h.occurredAt)}</td><td>{h.userName}</td><td>{h.detail}</td></tr>
          ))}
          {data && !data.items.length && <tr><td colSpan={3} className={T.empty}>{t("info.history.empty")}</td></tr>}
        </tbody>
      </table>
      {pages > 1 && (
        <div className="mt-3 flex items-center justify-end gap-2 text-[13px]">
          <button type="button" className="rounded border px-2 py-0.5 disabled:opacity-40" disabled={page === 0} onClick={() => setPage(page - 1)}>‹</button>
          <span>{page + 1} / {pages}</span>
          <button type="button" className="rounded border px-2 py-0.5 disabled:opacity-40" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>›</button>
        </div>
      )}
    </div>
  );
}

/** Hồ sơ cửa hàng → Thông tin gian hàng (ảnh 177). */
export default function StoreProfilePage() {
  const { data, error } = useStoreProfile();
  const t = useT(storeProfileNs);
  const tc = useT(commonNs);
  return (
    <ProfileCard>
      <Tabs defaultValue="general" className="gap-0">
        <TabsList variant="line" className={SETTINGS_TABS.list}>
          <TabsTrigger value="general" className={SETTINGS_TABS.trigger}>{t("info.tabs.general")}</TabsTrigger>
          <TabsTrigger value="history" className={SETTINGS_TABS.trigger}>{t("info.tabs.history")}</TabsTrigger>
        </TabsList>
        <TabsContent value="general">
          {error ? <p className="p-5 text-[13px] text-destructive">{errorMessage(error)}</p>
            : data ? <StoreInfoGeneralTab profile={data} /> : <p className="p-5 text-[13px] text-muted-foreground">{tc("status.loading")}</p>}
        </TabsContent>
        <TabsContent value="history"><HistoryTab /></TabsContent>
      </Tabs>
    </ProfileCard>
  );
}
