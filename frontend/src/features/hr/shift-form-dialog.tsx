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
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { hrNs, type HrT } from "@/messages/hr";

const duration = (t: HrT, m: number) =>
  (m % 60 ? t("payslip.hoursMinutes", { hours: Math.floor(m / 60), minutes: m % 60 }) : t("shift.hours", { hours: Math.floor(m / 60) }));

/**
 * Tạo / sửa ca làm việc (tên, giờ bắt đầu, giờ kết thúc; kết thúc ≤ bắt đầu = ca qua đêm).
 * Không truyền shift → màn danh sách ca kèm nút tạo; chọn 1 ca để sửa / xóa. initialMode "create" mở thẳng form tạo.
 */
export function ShiftFormDialog({ shift, initialMode = "list", onClose, onSaved }: {
  shift?: Shift; initialMode?: "list" | "create"; onClose: () => void; onSaved?: (s: Shift) => void;
}) {
  const t = useT(hrNs);
  const tc = useT(commonNs);
  const { data: shifts = [] } = useShifts();
  const [editing, setEditing] = useState<Shift | "new" | null>(shift ?? (initialMode === "create" ? "new" : null));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing === null ? t("shift.title") : editing === "new" ? t("shift.addTitle") : t("shift.editTitle")}</DialogTitle>
        </DialogHeader>
        {editing === null ? (
          <div className="space-y-2 text-[13px]">
            {!shifts.length && <p className="py-4 text-center text-muted-foreground">{t("shift.empty")}</p>}
            {shifts.map((s) => (
              <button key={s.id} type="button" onClick={() => setEditing(s)}
                className={cn("flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left hover:border-primary", !s.active && "opacity-60")}>
                <span className="flex-1"><span className="font-medium">{s.name}</span>
                  <span className="ml-2 text-muted-foreground">{hm(s.startTime)} - {hm(s.endTime)} · {duration(t, s.minutes)}</span>
                  {!s.active && <span className="ml-2 text-xs text-muted-foreground">({tc("status.inactive")})</span>}</span>
                <Pencil className="size-3.5 text-muted-foreground" />
              </button>
            ))}
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>{tc("actions.close")}</Button>
              <Button onClick={() => setEditing("new")}><Plus className="size-4" /> {t("shift.add")}</Button>
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
  const t = useT(hrNs);
  const tc = useT(commonNs);
  const [name, setName] = useState(shift?.name ?? "");
  const [start, setStart] = useState(hm(shift?.startTime) || "08:00");
  const [end, setEnd] = useState(hm(shift?.endTime) || "12:00");
  const [active, setActive] = useState(shift?.active ?? true);
  const save = useHrMutation(() => api<Shift>(shift ? `/hr/shifts/${shift.id}` : "/hr/shifts", {
    method: shift ? "PUT" : "POST", body: { name, startTime: start, endTime: end, active },
  }), shift ? t("shift.toastUpdated") : t("shift.toastAdded"), onSaved);
  const remove = useHrMutation(() => api(`/hr/shifts/${shift?.id}`, { method: "DELETE" }), t("shift.toastDeleted"), () => onCancel());
  const overnight = start && end && end <= start;
  return (
    <div className="space-y-3 text-[13px]">
      <label className="grid gap-1.5"><span className="font-medium">{t("shift.name")} *</span>
        <Input autoFocus value={name} maxLength={100} placeholder={t("shift.namePlaceholder")} onChange={(e) => setName(e.target.value)} /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1.5"><span className="font-medium">{t("shift.start")}</span>
          <TimePicker value={start} onChange={(v) => setStart(v)} /></label>
        <label className="grid gap-1.5"><span className="font-medium">{t("shift.end")}</span>
          <TimePicker value={end} onChange={(v) => setEnd(v)} /></label>
      </div>
      {overnight && <p className="text-xs text-muted-foreground">{t("shift.overnight", { time: end })}</p>}
      {shift && (
        <label className="flex items-center gap-2">
          <input type="checkbox" className="size-4 accent-primary" checked={active} onChange={(e) => setActive(e.target.checked)} /> {tc("status.active")}
        </label>
      )}
      <DialogFooter>
        {shift && (
          <Button variant="outline" className="mr-auto text-destructive" disabled={remove.isPending}
            onClick={() => { if (confirm(t("shift.confirmDelete", { name: shift.name }))) remove.mutate(undefined); }}>
            {t("shift.delete")}</Button>
        )}
        <Button variant="outline" onClick={onCancel}>{tc("actions.skip")}</Button>
        <Button disabled={!name.trim() || !start || !end || start === end || save.isPending} onClick={() => save.mutate(undefined)}>{tc("actions.save")}</Button>
      </DialogFooter>
    </div>
  );
}
