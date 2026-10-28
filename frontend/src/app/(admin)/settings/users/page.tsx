"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ListEmptyRow } from "@/components/ui/list-empty-state";
import { RolesTab } from "@/features/settings/roles-tab";
import { SETTINGS_TABLE as T, SETTINGS_TABS, SettingsPage, StatusPill } from "@/features/settings/settings-shell";
import { UserFormDialog } from "@/features/settings/user-form-dialog";
import { api, type PageResponse } from "@/lib/api-client";
import { useCurrentUser, type User } from "@/lib/use-current-user";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { settingsNs } from "@/messages/settings";

const PAGE_SIZE = 20;

/** Tab Tài khoản người dùng: tìm kiếm, bảng tài khoản, bấm dòng để sửa. */
function UsersTab() {
  const { data: me } = useCurrentUser();
  const t = useT(settingsNs);
  const tc = useT(commonNs);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [dialog, setDialog] = useState<{ key: number; user?: User } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["users", q, page],
    queryFn: () =>
      api<PageResponse<User>>(`/users?q=${encodeURIComponent(q)}&page=${page}&size=${PAGE_SIZE}`),
  });
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="relative w-72">
          <Search className="absolute top-[7px] left-2 size-4 text-muted-foreground" />
          <input aria-label={t("users.search")} placeholder={t("users.searchPlaceholder")} value={q}
            onChange={(e) => { setQ(e.target.value); setPage(0); }}
            className="h-[30px] w-full rounded-md border border-[#d5d9df] pr-2 pl-8 text-[13px] outline-none focus:border-primary" />
        </div>
        <Button className="ml-auto" size="sm" variant="outline" onClick={() => setDialog({ key: Date.now() })}><Plus className="size-4" /> {t("users.create")}</Button>
      </div>
      <table className={T.table}>
        <thead className={T.head}><tr>
          <th>{t("users.colDisplayName")}</th><th>{t("users.colUsername")}</th><th>{t("users.colPhone")}</th><th>{t("users.colRole")}</th><th>{t("users.colBranch")}</th><th className="w-32">{t("users.colStatus")}</th>
        </tr></thead>
        <tbody>
          {isLoading && <tr><td colSpan={6} className={T.empty}>{tc("status.loading")}</td></tr>}
          {data && !data.items.length && <ListEmptyRow cols={6} what={t("users.emptyWhat")} compact />}
          {data?.items.map((u) => (
            <tr key={u.id} className={`${T.row} cursor-pointer hover:bg-[#f7f9fc]`} tabIndex={0}
              onClick={() => setDialog({ key: Date.now(), user: u })}
              onKeyDown={(e) => e.key === "Enter" && setDialog({ key: Date.now(), user: u })}>
              <td>{u.fullName}{u.id === me?.user.id && <span className="ml-1.5 rounded bg-primary-tint px-1 text-[11px] text-primary">{t("users.me")}</span>}</td>
              <td>{u.username}{u.twoFactorEnabled && <span className="ml-1.5 rounded bg-primary/10 px-1 text-[11px] text-primary">{t("users.twoFactorOn")}</span>}</td>
              <td>{u.phone}</td>
              <td>{u.roleName}</td>
              <td>{u.branches.map((b) => b.name).join(", ")}</td>
              <td><StatusPill on={u.active}>{u.active ? tc("status.active") : tc("status.inactive")}</StatusPill></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center justify-end gap-2 text-[13px]">
        <span className="text-muted-foreground">{t("users.totalPages", { total: data?.total ?? 0, page: page + 1, pages: totalPages })}</span>
        <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>{t("common.prev")}</Button>
        <Button size="sm" variant="outline" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>{t("common.next")}</Button>
      </div>
      {dialog && (
        <UserFormDialog key={dialog.key} open user={dialog.user} onOpenChange={(o) => !o && setDialog(null)} />
      )}
    </div>
  );
}

/** Thiết lập → Quản lý người dùng: Tài khoản người dùng | Quản lý vai trò. */
export default function UsersPage() {
  const t = useT(settingsNs);
  return (
    <SettingsPage hint={t("users.hint")}>
      <div className="rounded-lg bg-background">
        <Tabs defaultValue="users" className="gap-0">
          <TabsList variant="line" className={SETTINGS_TABS.list}>
            <TabsTrigger value="users" className={SETTINGS_TABS.trigger}>{t("users.tabUsers")}</TabsTrigger>
            <TabsTrigger value="roles" className={SETTINGS_TABS.trigger}>{t("users.tabRoles")}</TabsTrigger>
          </TabsList>
          <TabsContent value="users" className="p-4"><UsersTab /></TabsContent>
          <TabsContent value="roles" className="p-4"><RolesTab /></TabsContent>
        </Tabs>
      </div>
    </SettingsPage>
  );
}
