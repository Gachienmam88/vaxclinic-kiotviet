"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ListEmptyRow } from "@/components/ui/list-empty-state";
import { BranchFormDialog } from "@/features/settings/branch-form-dialog";
import { useBranches, type Branch } from "@/features/settings/settings-queries";
import { SETTINGS_TABLE as T, SettingsCard, SettingsPage, StatusPill } from "@/features/settings/settings-shell";
import { useCurrentUser } from "@/lib/use-current-user";
import { joinAddress } from "@/lib/vn-admin-search";

/** Thiết lập → Quản lý chi nhánh. */
export default function BranchesPage() {
  const { data: branches = [], isLoading } = useBranches();
  const { can } = useCurrentUser();
  // key forces the dialog to remount with fresh form state for each open
  const [dialog, setDialog] = useState<{ key: number; branch?: Branch } | null>(null);

  return (
    <SettingsPage hint={<>Mỗi chi nhánh (điểm tiêm) có tồn kho, sổ quỹ và người dùng riêng. Gán người dùng vào chi nhánh trong Quản lý người dùng.</>}>
      <SettingsCard title="Quản lý chi nhánh" description="Quản lý thông tin, người dùng và địa chỉ của các chi nhánh.">
        <div className="space-y-3 p-4">
          {can("branch.manage") && (
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setDialog({ key: Date.now() })}><Plus className="size-4" /> Tạo chi nhánh</Button>
            </div>
          )}
          <table className={T.table}>
            <thead className={T.head}><tr>
              <th className="w-28">Mã</th><th>Tên chi nhánh</th><th>Địa chỉ</th><th className="w-36">Điện thoại</th>
              <th className="w-32 text-right">SL người dùng</th><th className="w-32">Trạng thái</th>
            </tr></thead>
            <tbody>
              {isLoading && <tr><td colSpan={6} className={T.empty}>Đang tải...</td></tr>}
              {!isLoading && !branches.length && <ListEmptyRow cols={6} what="chi nhánh" compact />}
              {branches.map((b) => (
                <tr key={b.id} className={can("branch.manage") ? `${T.row} cursor-pointer hover:bg-[#f7f9fc]` : T.row}
                  onClick={() => can("branch.manage") && setDialog({ key: Date.now(), branch: b })}>
                  <td>{b.code}</td>
                  <td>{b.name}</td>
                  <td>{joinAddress(b.address, b.ward, b.province)}</td>
                  <td>{b.phone}</td>
                  <td className="text-right text-primary">{b.userCount}</td>
                  <td><StatusPill on={b.active}>{b.active ? "Đang hoạt động" : "Ngừng hoạt động"}</StatusPill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SettingsCard>
      {dialog && (
        <BranchFormDialog key={dialog.key} open branch={dialog.branch} onOpenChange={(o) => !o && setDialog(null)} />
      )}
    </SettingsPage>
  );
}
