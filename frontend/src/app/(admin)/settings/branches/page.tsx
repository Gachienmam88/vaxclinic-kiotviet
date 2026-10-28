"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ListEmptyRow } from "@/components/ui/list-empty-state";
import { BranchFormDialog } from "@/features/settings/branch-form-dialog";
import { useBranches, type Branch } from "@/features/settings/settings-queries";
import { SETTINGS_TABLE as T, SettingsCard, SettingsPage, StatusPill } from "@/features/settings/settings-shell";
import { useCurrentUser } from "@/lib/use-current-user";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { settingsNs } from "@/messages/settings";
import { joinAddress } from "@/lib/vn-admin-search";

/** Thiết lập → Quản lý chi nhánh. */
export default function BranchesPage() {
  const { data: branches = [], isLoading } = useBranches();
  const { can } = useCurrentUser();
  const t = useT(settingsNs);
  const tc = useT(commonNs);
  // key forces the dialog to remount with fresh form state for each open
  const [dialog, setDialog] = useState<{ key: number; branch?: Branch } | null>(null);

  return (
    <SettingsPage hint={t("branches.hint")}>
      <SettingsCard title={t("branches.title")} description={t("branches.description")}>
        <div className="space-y-3 p-4">
          {can("branch.manage") && (
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setDialog({ key: Date.now() })}><Plus className="size-4" /> {t("branches.create")}</Button>
            </div>
          )}
          <table className={T.table}>
            <thead className={T.head}><tr>
              <th className="w-28">{t("branches.colCode")}</th><th>{t("branches.colName")}</th><th>{t("branches.colAddress")}</th><th className="w-36">{t("branches.colPhone")}</th>
              <th className="w-32 text-right">{t("branches.colUsers")}</th><th className="w-32">{t("branches.colStatus")}</th>
            </tr></thead>
            <tbody>
              {isLoading && <tr><td colSpan={6} className={T.empty}>{tc("status.loading")}</td></tr>}
              {!isLoading && !branches.length && <ListEmptyRow cols={6} what={t("branches.emptyWhat")} compact />}
              {branches.map((b) => (
                <tr key={b.id} className={can("branch.manage") ? `${T.row} cursor-pointer hover:bg-[#f7f9fc]` : T.row}
                  onClick={() => can("branch.manage") && setDialog({ key: Date.now(), branch: b })}>
                  <td>{b.code}</td>
                  <td>{b.name}</td>
                  <td>{joinAddress(b.address, b.ward, b.province)}</td>
                  <td>{b.phone}</td>
                  <td className="text-right text-primary">{b.userCount}</td>
                  <td><StatusPill on={b.active}>{b.active ? tc("status.active") : tc("status.inactive")}</StatusPill></td>
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
