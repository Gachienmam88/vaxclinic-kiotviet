"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { SettingSwitch } from "@/features/settings/setting-switch";
import { addDays, dmy, hm, isoDate, parseIso, useHrMutation, useShifts } from "./hr-queries";
import type { EmployeeRow } from "./hr-types";
import { WEEKDAY_SHORT } from "./hr-types";
import { ShiftFormDialog } from "./shift-form-dialog";
import { DatePicker } from "@/components/ui/date-picker";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { hrNs } from "@/messages/hr";

/**
 * Thêm lịch làm việc cho 1 nhân viên vào 1 ngày: chọn ca (nhiều ca), lặp lại hàng tuần theo thứ + ngày kết thúc,
 * áp dụng thêm cho nhân viên khác. POST /hr/schedules.
 */
export function ScheduleAddDialog({ employee, date, employees, onClose }: {
  employee: EmployeeRow; date: string; employees: EmployeeRow[]; onClose: () => void;
}) {
  const t = useT(hrNs);
  const tc = useT(commonNs);
  const { data: shifts = [] } = useShifts();
  const active = shifts.filter((s) => s.active);
  const dow = (parseIso(date).getDay() + 6) % 7 + 1;
  const [shiftIds, setShiftIds] = useState<string[]>([]);
  const [repeat, setRepeat] = useState(false);
  const [weekdays, setWeekdays] = useState<number[]>([dow]);
  const [until, setUntil] = useState(isoDate(addDays(parseIso(date), 27)));
  const [others, setOthers] = useState<string[]>([]);
  const [otherQ, setOtherQ] = useState("");
  const [creatingShift, setCreatingShift] = useState(false);
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const save = useHrMutation(() => api<{ created: number }>("/hr/schedules", {
    method: "POST",
    body: { employeeIds: [employee.id, ...others], shiftIds, date, repeatWeekly: repeat, weekdays: repeat ? weekdays : undefined,
      until: repeat ? until : undefined },
  }), undefined, (r) => {
    toast.success(r.created ? t("scheduleAdd.toastCreated", { count: r.created }) : t("scheduleAdd.toastExists"));
    onClose();
  });

  const term = otherQ.trim().toLowerCase();
  const candidates = employees.filter((e) => e.id !== employee.id && (!term || `${e.code} ${e.name}`.toLowerCase().includes(term)));
  const box = "flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[13px] cursor-pointer hover:border-primary";
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{t("scheduleAdd.title")}</DialogTitle></DialogHeader>
        <p className="text-[13px]"><span className="font-semibold">{employee.name}</span>
          <span className="text-muted-foreground"> · {employee.code} · {dmy(date)}</span></p>
        <section className="space-y-2">
          <div className="flex items-center justify-between text-[13px] font-semibold">{t("scheduleAdd.pickShifts")}
            <button type="button" className="text-[12px] font-normal text-primary hover:underline" onClick={() => setCreatingShift(true)}>{t("scheduleAdd.createShift")}</button>
          </div>
          {!active.length && <p className="text-[13px] text-muted-foreground">{t("scheduleAdd.noShifts")}</p>}
          <div className="grid grid-cols-2 gap-2">
            {active.map((s) => (
              <label key={s.id} className={cn(box, shiftIds.includes(s.id) && "border-primary bg-primary-tint")}>
                <input type="checkbox" className="size-4 accent-primary" checked={shiftIds.includes(s.id)} onChange={() => setShiftIds(toggle(shiftIds, s.id))} />
                <span><span className="font-medium">{s.name}</span><br /><span className="text-xs text-muted-foreground">{hm(s.startTime)} - {hm(s.endTime)}</span></span>
              </label>
            ))}
          </div>
        </section>
        <section className="space-y-2 text-[13px]">
          <div className="flex items-center justify-between font-semibold">{t("scheduleAdd.repeatWeekly")}
            <SettingSwitch checked={repeat} onCheckedChange={setRepeat} aria-label={t("scheduleAdd.repeatWeekly")} /></div>
          {repeat && (
            <div className="space-y-2">
              <div className="flex gap-1.5">
                {WEEKDAY_SHORT.map((w, i) => (
                  <button key={w} type="button" aria-pressed={weekdays.includes(i + 1)}
                    onClick={() => setWeekdays(weekdays.includes(i + 1) ? weekdays.filter((d) => d !== i + 1) : [...weekdays, i + 1])}
                    className={cn("size-8 rounded-full border text-xs", weekdays.includes(i + 1) ? "border-primary bg-primary text-white" : "hover:border-primary")}>{t(w)}</button>
                ))}
              </div>
              <label className="flex items-center gap-2">{t("scheduleAdd.until")}
                <DatePicker className="h-8 w-40" value={until} min={date} onChange={(v) => setUntil(v)} /></label>
            </div>
          )}
        </section>
        <section className="space-y-2 text-[13px]">
          <p className="font-semibold">{t("scheduleAdd.others")} <span className="font-normal text-muted-foreground">({t("scheduleAdd.selected", { count: others.length })})</span></p>
          <Input className="h-8" placeholder={t("attendance.searchEmployee")} value={otherQ} onChange={(e) => setOtherQ(e.target.value)} />
          <div className="max-h-36 space-y-1 overflow-y-auto">
            {candidates.slice(0, 100).map((e) => (
              <label key={e.id} className="flex cursor-pointer items-center gap-2 px-1 py-0.5 hover:bg-[#f3f6fa]">
                <input type="checkbox" className="size-4 accent-primary" checked={others.includes(e.id)} onChange={() => setOthers(toggle(others, e.id))} />
                {e.name} <span className="text-muted-foreground">{e.code}</span>
              </label>
            ))}
          </div>
        </section>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{tc("actions.skip")}</Button>
          <Button disabled={!shiftIds.length || (repeat && (!weekdays.length || !until)) || save.isPending} onClick={() => save.mutate(undefined)}>{tc("actions.save")}</Button>
        </DialogFooter>
        {creatingShift && <ShiftFormDialog initialMode="create" onClose={() => setCreatingShift(false)}
          onSaved={(s) => setShiftIds((ids) => [...ids, s.id])} />}
      </DialogContent>
    </Dialog>
  );
}
