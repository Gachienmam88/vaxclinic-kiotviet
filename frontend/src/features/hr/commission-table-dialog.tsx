"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { useHrMutation } from "./hr-queries";
import type { CommissionTable } from "./hr-types";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { hrNs } from "@/messages/hr";

/** Thêm / sửa bảng hoa hồng (tên + trạng thái áp dụng). */
export function CommissionTableDialog({ table, onClose, onSaved }: {
  table?: CommissionTable; onClose: () => void; onSaved?: (t: CommissionTable) => void;
}) {
  const t = useT(hrNs);
  const tc = useT(commonNs);
  const [name, setName] = useState(table?.name ?? "");
  const [active, setActive] = useState(table?.active ?? true);
  const save = useHrMutation(() => api<CommissionTable>(table ? `/hr/commission-tables/${table.id}` : "/hr/commission-tables", {
    method: table ? "PUT" : "POST", body: { name: name.trim(), active },
  }), table ? t("commissionTable.toastUpdated") : t("commissionTable.toastAdded"), (r) => { onSaved?.(r); onClose(); });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>{table ? t("commissionTable.editTitle") : t("commissionTable.addTitle")}</DialogTitle></DialogHeader>
        <div className="space-y-3 text-[13px]">
          <label className="grid gap-1.5">{t("commissionTable.name")}
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t("commissionTable.namePlaceholder")} />
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="size-4 accent-primary" checked={active} onChange={(e) => setActive(e.target.checked)} />
            {t("commissionTable.activeHint")}
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{tc("actions.skip")}</Button>
          <Button disabled={!name.trim() || save.isPending} onClick={() => save.mutate(undefined)}>{tc("actions.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
