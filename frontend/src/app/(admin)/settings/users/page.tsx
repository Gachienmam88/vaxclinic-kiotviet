"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RolesTab } from "@/features/settings/roles-tab";
import { SETTINGS_TABLE as T, SETTINGS_TABS, SettingsPage, StatusPill } from "@/features/settings/settings-shell";
import { UserFormDialog } from "@/features/settings/user-form-dialog";
import { api, type PageResponse } from "@/lib/api-client";
import { useCurrentUser, type User } from "@/lib/use-current-user";

const PAGE_SIZE = 20;

/** Tab Tài khoản người dùng: tìm kiếm, bảng tài khoản, bấm dòng để sửa. */
function UsersTab() {
  const { data: me } = useCurrentUser();
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
          <input aria-label="Tìm người dùng" placeholder="Tìm theo tên đăng nhập, họ tên, SĐT" value={q}
            onChange={(e) => { setQ(e.target.value); setPage(0); }}
            className="h-[30px] w-full rounded-md border border-[#d5d9df] pr-2 pl-8 text-[13px] outline-none focus:border-primary" />
        </div>
        <Button className="ml-auto" size="sm" variant="outline" onClick={() => setDialog({ key: Date.now() })}><Plus className="size-4" /> Tạo tài khoản</Button>
      </div>
      <table className={T.table}>
        <thead className={T.head}><tr>
          <th>Tên hiển thị</th><th>Tên đăng nhập</th><th>Điện thoại</th><th>Vai trò</th><th>Điểm tiêm</th><th className="w-32">Trạng thái</th>
        </tr></thead>
        <tbody>
          {isLoading && <tr><td colSpan={6} className={T.empty}>Đang tải...</td></tr>}
          {data && !data.items.length && <tr><td colSpan={6} className={T.empty}>Không có người dùng</td></tr>}
          {data?.items.map((u) => (
            <tr key={u.id} className={`${T.row} cursor-pointer hover:bg-[#f7f9fc]`} tabIndex={0}
              onClick={() => setDialog({ key: Date.now(), user: u })}
              onKeyDown={(e) => e.key === "Enter" && setDialog({ key: Date.now(), user: u })}>
              <td>{u.fullName}{u.id === me?.user.id && <span className="ml-1.5 rounded bg-[#e5f0ff] px-1 text-[11px] text-primary">Tôi</span>}</td>
              <td>{u.username}</td>
              <td>{u.phone}</td>
              <td>{u.roleName}</td>
              <td>{u.branches.map((b) => b.name).join(", ")}</td>
              <td><StatusPill on={u.active}>{u.active ? "Đang hoạt động" : "Ngừng hoạt động"}</StatusPill></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center justify-end gap-2 text-[13px]">
        <span className="text-muted-foreground">Tổng {data?.total ?? 0} người dùng — trang {page + 1}/{totalPages}</span>
        <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Trước</Button>
        <Button size="sm" variant="outline" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>Sau</Button>
      </div>
      {dialog && (
        <UserFormDialog key={dialog.key} open user={dialog.user} onOpenChange={(o) => !o && setDialog(null)} />
      )}
    </div>
  );
}

/** Thiết lập → Quản lý người dùng: Tài khoản người dùng | Quản lý vai trò. */
export default function UsersPage() {
  return (
    <SettingsPage hint={<>Thiết lập quyền mặc định theo vai trò để phân quyền người dùng nhanh chóng.</>}>
      <div className="rounded-lg bg-background">
        <Tabs defaultValue="users" className="gap-0">
          <TabsList variant="line" className={SETTINGS_TABS.list}>
            <TabsTrigger value="users" className={SETTINGS_TABS.trigger}>Tài khoản người dùng</TabsTrigger>
            <TabsTrigger value="roles" className={SETTINGS_TABS.trigger}>Quản lý vai trò</TabsTrigger>
          </TabsList>
          <TabsContent value="users" className="p-4"><UsersTab /></TabsContent>
          <TabsContent value="roles" className="p-4"><RolesTab /></TabsContent>
        </Tabs>
      </div>
    </SettingsPage>
  );
}
