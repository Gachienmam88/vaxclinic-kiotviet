"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, errorMessage } from "@/lib/api-client";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { settingsNs } from "@/messages/settings";
import type { Role } from "./settings-queries";

/** Nhóm quyền hiển thị — khớp Permissions.java (identity-service). Nhãn: settings.json roleForm.groups / roleForm.perms. */
const PERMISSION_GROUPS = [
  { title: "catalog", perms: [["catalog.view", "catalogView"], ["catalog.manage", "catalogManage"],
    ["inventory.view", "inventoryView"], ["inventory.manage", "inventoryManage"]] },
  { title: "sales", perms: [["sales.perform", "salesPerform"], ["sales.cancel", "salesCancel"],
    ["patient.view", "patientView"], ["patient.manage", "patientManage"]] },
  { title: "cashbook", perms: [["cashbook.manage", "cashbookManage"], ["report.view", "reportView"]] },
  { title: "hr", perms: [["hr.manage", "hrManage"]] },
  { title: "vaccination", perms: [["reception.perform", "receptionPerform"], ["screening.perform", "screeningPerform"], ["injection.perform", "injectionPerform"]] },
  { title: "settings", perms: [["user.manage", "userManage"], ["branch.manage", "branchManage"],
    ["settings.manage", "settingsManage"]] },
] as const;

/** Tạo / sửa / sao chép vai trò. copyFrom: tạo vai trò mới với quyền của vai trò có sẵn. */
export function RoleFormDialog({ role, copyFrom, onClose }: { role?: Role; copyFrom?: Role; onClose: () => void }) {
  const qc = useQueryClient();
  const t = useT(settingsNs);
  const tc = useT(commonNs);
  const base = role ?? copyFrom;
  const [name, setName] = useState(role?.name ?? (copyFrom ? t("roleForm.copyName", { name: copyFrom.name }) : ""));
  const [description, setDescription] = useState(base?.description ?? "");
  const [perms, setPerms] = useState<string[]>(base?.permissions ?? []);
  const isAdmin = role?.code === "ADMIN";
  const save = useMutation({
    mutationFn: () => api(role ? `/roles/${role.id}` : "/roles", { method: role ? "PUT" : "POST", body: { name, description, permissions: perms } }),
    onSuccess: () => {
      toast.success(role ? t("roleForm.updated") : t("roleForm.created"));
      qc.invalidateQueries({ queryKey: ["roles"] });
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const toggle = (p: string, on: boolean) => setPerms(on ? [...perms, p] : perms.filter((x) => x !== p));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{role ? t("roleForm.editTitle") : t("roleForm.createTitle")}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
          <div className="grid gap-1.5"><Label>{t("roleForm.name")}</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="grid gap-1.5"><Label>{t("roleForm.description")}</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        </div>
        {isAdmin && <p className="text-sm text-muted-foreground">{t("roleForm.adminNote")}</p>}
        <div className="space-y-3 text-sm">
          {PERMISSION_GROUPS.map((g) => (
            <div key={g.title} className="rounded-md border p-3">
              <p className="mb-2 font-medium">{t(`roleForm.groups.${g.title}`)}</p>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {g.perms.map(([code, label]) => (
                  <label key={code} className="flex items-center gap-2">
                    <Checkbox checked={isAdmin || perms.includes(code)} disabled={isAdmin} onCheckedChange={(v) => toggle(code, v === true)} />
                    {t(`roleForm.perms.${label}`)}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{tc("actions.skip")}</Button>
          <Button disabled={!name.trim() || save.isPending} onClick={() => save.mutate()}>{tc("actions.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
