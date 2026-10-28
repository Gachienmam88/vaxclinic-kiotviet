"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SETTINGS_TABLE as T, SETTINGS_TABS } from "@/features/settings/settings-shell";
import { StoreInfoGeneralTab } from "@/features/store-profile/store-info-general-tab";
import { ProfileCard } from "@/features/store-profile/store-profile-shell";
import { useStoreHistory, useStoreProfile } from "@/features/store-profile/store-profile-queries";
import { errorMessage } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";

/** Tab "Lịch sử cập nhật": các thay đổi hồ sơ / gian hàng (Lịch sử thao tác tính năng "Hồ sơ cửa hàng"). */
function HistoryTab() {
  const [page, setPage] = useState(0);
  const { data } = useStoreHistory(page);
  const pages = data ? Math.ceil(data.total / data.size) : 0;
  return (
    <div className="px-5 py-4">
      <table className={T.table}>
        <thead className={T.head}><tr><th className="w-40">Thời gian</th><th className="w-48">Người thực hiện</th><th>Nội dung</th></tr></thead>
        <tbody>
          {data?.items.map((h) => (
            <tr key={h.id} className={T.row}><td>{formatDateTime(h.occurredAt)}</td><td>{h.userName}</td><td>{h.detail}</td></tr>
          ))}
          {data && !data.items.length && <tr><td colSpan={3} className={T.empty}>Chưa có lịch sử cập nhật</td></tr>}
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
  return (
    <ProfileCard>
      <Tabs defaultValue="general" className="gap-0">
        <TabsList variant="line" className={SETTINGS_TABS.list}>
          <TabsTrigger value="general" className={SETTINGS_TABS.trigger}>Thông tin chung</TabsTrigger>
          <TabsTrigger value="history" className={SETTINGS_TABS.trigger}>Lịch sử cập nhật</TabsTrigger>
        </TabsList>
        <TabsContent value="general">
          {error ? <p className="p-5 text-[13px] text-destructive">{errorMessage(error)}</p>
            : data ? <StoreInfoGeneralTab profile={data} /> : <p className="p-5 text-[13px] text-muted-foreground">Đang tải...</p>}
        </TabsContent>
        <TabsContent value="history"><HistoryTab /></TabsContent>
      </Tabs>
    </ProfileCard>
  );
}
