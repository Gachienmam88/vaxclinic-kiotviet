"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { useHrMutation } from "./hr-queries";
import type { CommissionTable } from "./hr-types";

/** Thêm / sửa bảng hoa hồng (tên + trạng thái áp dụng). */
export function CommissionTableDialog({ table, onClose, onSaved }: {
  table?: CommissionTable; onClose: () => void; onSaved?: (t: CommissionTable) => void;
}) {
  const [name, setName] = useState(table?.name ?? "");
  const [active, setActive] = useState(table?.active ?? true);
  const save = useHrMutation(() => api<CommissionTable>(table ? `/hr/commission-tables/${table.id}` : "/hr/commission-tables", {
    method: table ? "PUT" : "POST", body: { name: name.trim(), active },
  }), table ? "Đã cập nhật bảng hoa hồng" : "Đã thêm bảng hoa hồng", (t) => { onSaved?.(t); onClose(); });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>{table ? "Sửa bảng hoa hồng" : "Thêm bảng hoa hồng"}</DialogTitle></DialogHeader>
        <div className="space-y-3 text-[13px]">
          <label className="grid gap-1.5">Tên bảng hoa hồng
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Hoa hồng bác sĩ" />
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="size-4 accent-primary" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Đang áp dụng (bỏ chọn: tạm ngừng tính hoa hồng theo bảng này)
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Bỏ qua</Button>
          <Button disabled={!name.trim() || save.isPending} onClick={() => save.mutate(undefined)}>Lưu</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
