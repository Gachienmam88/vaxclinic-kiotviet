"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api-client";
import { useHrMutation } from "./hr-queries";
import type { CatalogItem } from "./hr-types";
import { HrField, hrInput } from "./hr-form-ui";

const LABEL = { departments: "phòng ban", "job-titles": "chức danh" } as const;

/** Popup "Tạo mới" Phòng ban / Chức danh (bộ lọc danh sách nhân viên, form nhân viên). */
export function CatalogCreateDialog({ kind, onClose, onCreated }: {
  kind: "departments" | "job-titles"; onClose: () => void; onCreated?: (c: CatalogItem) => void;
}) {
  const [name, setName] = useState("");
  const save = useHrMutation(() => api<CatalogItem>(`/hr/${kind}`, { method: "POST", body: { name } }),
    `Đã tạo ${LABEL[kind]}`, (c) => { onCreated?.(c); onClose(); });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Tạo {LABEL[kind]}</DialogTitle></DialogHeader>
        <HrField label={`Tên ${LABEL[kind]}`}>
          <input autoFocus className={hrInput} value={name} maxLength={100} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && name.trim() && save.mutate(undefined)} />
        </HrField>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Bỏ qua</Button>
          <Button disabled={!name.trim() || save.isPending} onClick={() => save.mutate(undefined)}>Lưu</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
