"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserFormDialog } from "@/features/settings/user-form-dialog";
import { api, type PageResponse } from "@/lib/api-client";
import type { User } from "@/lib/use-current-user";

const PAGE_SIZE = 20;

export default function UsersPage() {
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
        <h1 className="text-xl font-semibold">Người dùng</h1>
        <Input className="ml-auto w-72 bg-background" placeholder="Tìm theo tên đăng nhập, họ tên, SĐT"
          value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
        <Button onClick={() => setDialog({ key: Date.now() })}><Plus className="size-4" /> Thêm người dùng</Button>
      </div>
      <div className="rounded-md border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tên đăng nhập</TableHead>
              <TableHead>Họ tên</TableHead>
              <TableHead>Điện thoại</TableHead>
              <TableHead>Vai trò</TableHead>
              <TableHead>Điểm tiêm</TableHead>
              <TableHead className="w-32">Trạng thái</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Đang tải...</TableCell></TableRow>
            )}
            {data?.items.map((u) => (
              <TableRow key={u.id} className="cursor-pointer" onClick={() => setDialog({ key: Date.now(), user: u })}>
                <TableCell className="font-medium">{u.username}</TableCell>
                <TableCell>{u.fullName}</TableCell>
                <TableCell>{u.phone}</TableCell>
                <TableCell>{u.roleName}</TableCell>
                <TableCell>{u.branches.map((b) => b.name).join(", ")}</TableCell>
                <TableCell>
                  <Badge variant={u.active ? "default" : "secondary"}>{u.active ? "Hoạt động" : "Đã khóa"}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end gap-2 text-sm">
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
