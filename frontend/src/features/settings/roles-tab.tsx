"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ListEmptyRow } from "@/components/ui/list-empty-state";
import { api, errorMessage } from "@/lib/api-client";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { settingsNs } from "@/messages/settings";
import { RoleFormDialog } from "./role-form-dialog";
import { SETTINGS_TABLE as T } from "./settings-layout-parts";
import { useRoles, type Role } from "./settings-queries";

/** Tab Quản lý vai trò: vai trò, mô tả, tài khoản đang dùng; sửa / sao chép / xóa. */
export function RolesTab() {
  const qc = useQueryClient();
  const { data: roles = [] } = useRoles();
  const t = useT(settingsNs);
  const tc = useT(commonNs);
  const [dialog, setDialog] = useState<{ role?: Role; copyFrom?: Role } | null>(null);
  const remove = useMutation({
    mutationFn: (id: string) => api(`/roles/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast.success(t("roles.deleted")); qc.invalidateQueries({ queryKey: ["roles"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setDialog({})}><Plus className="size-4" /> {t("roles.create")}</Button>
      </div>
      <table className={T.table}>
        <thead className={T.head}><tr>
          <th>{t("roles.colRole")}</th><th>{t("roles.colDescription")}</th><th>{t("roles.colAccounts")}</th><th className="w-28 text-right">{t("common.actions")}</th>
        </tr></thead>
        <tbody>
          {!roles.length && <ListEmptyRow cols={4} what={t("roles.emptyWhat")} compact />}
          {roles.map((r) => (
            <tr key={r.id} className={T.row}>
              <td className="font-medium">{r.name}</td>
              <td className="text-muted-foreground">{r.description}</td>
              <td>{r.usernames.length ? r.usernames.join(", ") : <span className="text-muted-foreground">{t("common.notSet")}</span>}</td>
              <td className="text-right whitespace-nowrap !py-1.5">
                <Button size="icon-sm" variant="ghost" title={tc("actions.edit")} aria-label={t("roles.editOf", { name: r.name })} onClick={() => setDialog({ role: r })}><Pencil className="size-4" /></Button>
                <Button size="icon-sm" variant="ghost" title={t("roles.copy")} aria-label={t("roles.copyOf", { name: r.name })} onClick={() => setDialog({ copyFrom: r })}><Copy className="size-4" /></Button>
                {!r.system && (
                  <Button size="icon-sm" variant="ghost" title={tc("actions.delete")} aria-label={t("roles.deleteOf", { name: r.name })} className="text-destructive"
                    onClick={() => confirm(t("roles.confirmDelete", { name: r.name })) && remove.mutate(r.id)}><Trash2 className="size-4" /></Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {dialog && <RoleFormDialog role={dialog.role} copyFrom={dialog.copyFrom} onClose={() => setDialog(null)} />}
    </div>
  );
}
