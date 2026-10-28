"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { hm, useHrMutation, useShifts } from "./hr-queries";
import type { Shift } from "./hr-types";
import { TimePicker } from "@/components/ui/time-picker";

const duration = (m: number) => `${Math.floor(m / 60)} giờ${m % 60 ? ` ${m % 60} phút` : ""}`;

/**
 * Tạo / sửa ca làm việc (tên, giờ bắt đầu, giờ kết thúc; kết thúc ≤ bắt đầu = ca qua đêm).
 * Không truyền shift → màn danh sách ca kèm nút tạo; chọn 1 ca để sửa / xóa. initialMode "create" mở thẳng form tạo.
 */
export function ShiftFormDialog({ shift, initialMode = "list", onClose, onSaved }: {
  shift?: Shift; initialMode?: "list" | "create"; onClose: () => void; onSaved?: (s: Shift) => void;
}) {
  const { data: shifts = [] } = useShifts();
  const [editing, setEditing] = useState<Shift | "new" | null>(shift ?? (initialMode === "create" ? "new" : null));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing === null ? "Ca làm việc" : editing === "new" ? "Thêm ca làm việc" : "Sửa ca làm việc"}</DialogTitle>
        </DialogHeader>
        {editing === null ? (
          <div className="space-y-2 text-[13px]">
            {!shifts.length && <p className="py-4 text-center text-muted-foreground">Cửa hàng chưa có ca làm việc nào</p>}
            {shifts.map((s) => (
              <button key={s.id} type="button" onClick={() => setEditing(s)}
                className={cn("flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left hover:border-primary", !s.active && "opacity-60")}>
                <span className="flex-1"><span className="font-medium">{s.name}</span>
                  <span className="ml-2 text-muted-foreground">{hm(s.startTime)} - {hm(s.endTime)} · {duration(s.minutes)}</span>
                  {!s.active && <span className="ml-2 text-xs text-muted-foreground">(Ngừng hoạt động)</span>}</span>
                <Pencil className="size-3.5 text-muted-foreground" />
              </button>
            ))}
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Đóng</Button>
              <Button onClick={() => setEditing("new")}><Plus className="size-4" /> Thêm ca</Button>
            </DialogFooter>
          </div>
        ) : (
          <ShiftForm key={editing === "new" ? "new" : editing.id} shift={editing === "new" ? undefined : editing}
            onCancel={() => (shift || initialMode === "create" ? onClose() : setEditing(null))}
            onSaved={(s) => { onSaved?.(s); if (shift || initialMode === "create") onClose(); else setEditing(null); }} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ShiftForm({ shift, onCancel, onSaved }: { shift?: Shift; onCancel: () => void; onSaved: (s: Shift) => void }) {
  const [name, setName] = useState(shift?.name ?? "");
  const [start, setStart] = useState(hm(shift?.startTime) || "08:00");
  const [end, setEnd] = useState(hm(shift?.endTime) || "12:00");
  const [active, setActive] = useState(shift?.active ?? true);
  const save = useHrMutation(() => api<Shift>(shift ? `/hr/shifts/${shift.id}` : "/hr/shifts", {
    method: shift ? "PUT" : "POST", body: { name, startTime: start, endTime: end, active },
  }), shift ? "Đã cập nhật ca làm việc" : "Đã thêm ca làm việc", onSaved);
  const remove = useHrMutation(() => api(`/hr/shifts/${shift?.id}`, { method: "DELETE" }), "Đã xóa ca làm việc", () => onCancel());
  const overnight = start && end && end <= start;
  return (
    <div className="space-y-3 text-[13px]">
      <label className="grid gap-1.5"><span className="font-medium">Tên ca *</span>
        <Input autoFocus value={name} maxLength={100} placeholder="VD: Ca sáng" onChange={(e) => setName(e.target.value)} /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1.5"><span className="font-medium">Giờ bắt đầu</span>
          <TimePicker value={start} onChange={(v) => setStart(v)} /></label>
        <label className="grid gap-1.5"><span className="font-medium">Giờ kết thúc</span>
          <TimePicker value={end} onChange={(v) => setEnd(v)} /></label>
      </div>
      {overnight && <p className="text-xs text-muted-foreground">Ca qua đêm: kết thúc lúc {end} ngày hôm sau</p>}
      {shift && (
        <label className="flex items-center gap-2">
          <input type="checkbox" className="size-4 accent-primary" checked={active} onChange={(e) => setActive(e.target.checked)} /> Đang hoạt động
        </label>
      )}
      <DialogFooter>
        {shift && (
          <Button variant="outline" className="mr-auto text-destructive" disabled={remove.isPending}
            onClick={() => { if (confirm(`Xóa ca ${shift.name}? Ca đã có lịch / chấm công sẽ chuyển sang ngừng hoạt động.`)) remove.mutate(undefined); }}>
            Xóa ca</Button>
        )}
        <Button variant="outline" onClick={onCancel}>Bỏ qua</Button>
        <Button disabled={!name.trim() || !start || !end || start === end || save.isPending} onClick={() => save.mutate(undefined)}>Lưu</Button>
      </DialogFooter>
    </div>
  );
}
