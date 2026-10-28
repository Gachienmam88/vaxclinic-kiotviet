"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BranchFormDialog } from "@/features/settings/branch-form-dialog";
import { useBranches, type Branch } from "@/features/settings/settings-queries";
import { useCurrentUser } from "@/lib/use-current-user";

export default function BranchesPage() {
  const { data: branches = [], isLoading } = useBranches();
  const { can } = useCurrentUser();
  // key forces the dialog to remount with fresh form state for each open
  const [dialog, setDialog] = useState<{ key: number; branch?: Branch } | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Điểm tiêm</h1>
        {can("branch.manage") && (
          <Button onClick={() => setDialog({ key: Date.now() })}><Plus className="size-4" /> Thêm điểm tiêm</Button>
        )}
      </div>
      <div className="rounded-md border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Mã</TableHead>
              <TableHead>Tên điểm tiêm</TableHead>
              <TableHead>Địa chỉ</TableHead>
              <TableHead className="w-36">Điện thoại</TableHead>
              <TableHead className="w-32">Trạng thái</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Đang tải...</TableCell></TableRow>
            )}
            {branches.map((b) => (
              <TableRow key={b.id} className={can("branch.manage") ? "cursor-pointer" : undefined}
                onClick={() => can("branch.manage") && setDialog({ key: Date.now(), branch: b })}>
                <TableCell className="font-medium">{b.code}</TableCell>
                <TableCell>{b.name}</TableCell>
                <TableCell>{b.address}</TableCell>
                <TableCell>{b.phone}</TableCell>
                <TableCell>
                  <Badge variant={b.active ? "default" : "secondary"}>{b.active ? "Hoạt động" : "Ngừng"}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {dialog && (
        <BranchFormDialog key={dialog.key} open branch={dialog.branch} onOpenChange={(o) => !o && setDialog(null)} />
      )}
    </div>
  );
}
