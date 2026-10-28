"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api-client";
import { useHrMutation } from "./hr-queries";
import type { CatalogItem } from "./hr-types";
import { HrField, hrInput } from "./hr-form-ui";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { hrNs } from "@/messages/hr";

/** Khóa chuỗi theo loại danh mục. */
const KEYS = {
  departments: { title: "catalog.createDepartment", name: "catalog.departmentName", toast: "catalog.departmentCreated" },
  "job-titles": { title: "catalog.createJobTitle", name: "catalog.jobTitleName", toast: "catalog.jobTitleCreated" },
} as const;

/** Popup "Tạo mới" Phòng ban / Chức danh (bộ lọc danh sách nhân viên, form nhân viên). */
export function CatalogCreateDialog({ kind, onClose, onCreated }: {
  kind: "departments" | "job-titles"; onClose: () => void; onCreated?: (c: CatalogItem) => void;
}) {
  const t = useT(hrNs);
  const tc = useT(commonNs);
  const keys = KEYS[kind];
  const [name, setName] = useState("");
  const save = useHrMutation(() => api<CatalogItem>(`/hr/${kind}`, { method: "POST", body: { name } }),
    t(keys.toast), (c) => { onCreated?.(c); onClose(); });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{t(keys.title)}</DialogTitle></DialogHeader>
        <HrField label={t(keys.name)}>
          <input autoFocus className={hrInput} value={name} maxLength={100} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && name.trim() && save.mutate(undefined)} />
        </HrField>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{tc("actions.skip")}</Button>
          <Button disabled={!name.trim() || save.isPending} onClick={() => save.mutate(undefined)}>{tc("actions.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
