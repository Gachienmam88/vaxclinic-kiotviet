"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarCheck, CalendarDays, Ellipsis, Fingerprint } from "lucide-react";
import { toast } from "sonner";
import { MonthCalendar } from "@/components/ui/month-calendar";
import { PickerPopover } from "@/components/ui/picker-popover";
import { api } from "@/lib/api-client";
import { AttendanceDialog } from "@/features/hr/attendance-dialog";
import { ShiftFormDialog } from "@/features/hr/shift-form-dialog";
import { TimesheetLegend, TimesheetWeekGrid } from "@/features/hr/timesheet-week-grid";
import { addDays, isoDate, mondayOf, parseIso, useAllEmployees, useAttendance, useHrMutation, useShifts } from "@/features/hr/hr-queries";
import type { AttendanceCell, Shift } from "@/features/hr/hr-types";
import { EmployeeSearch, thisMonday, ViewSelect, WEEK_BTN, WeekNavigator, weekDays } from "@/features/hr/week-toolbar";

/** Bảng chấm công (ảnh KiotViet 113): lưới tuần theo ca / nhân viên, chấm công tay, Duyệt chấm công. */
export default function TimesheetsPage() {
  const [monday, setMonday] = useState(thisMonday);
  const [employeeId, setEmployeeId] = useState("");
  const [mode, setMode] = useState<"shift" | "employee">("shift");
  const [picking, setPicking] = useState(false);
  const [pickMonth, setPickMonth] = useState("");
  const [menu, setMenu] = useState(false);
  const [shiftDialog, setShiftDialog] = useState<Shift | "new" | "list" | null>(null);
  const [open, setOpen] = useState<{ shift: Shift; date: string; cell?: AttendanceCell } | null>(null);
  const days = useMemo(() => weekDays(monday), [monday]);
  const from = isoDate(monday);
  const to = isoDate(addDays(monday, 6));
  const { data: all = [] } = useAllEmployees();
  const { data: shifts = [] } = useShifts();
  const { data: cells = [] } = useAttendance(from, to);
  const employees = employeeId ? all.filter((e) => e.id === employeeId) : all;
  const shown = employeeId ? cells.filter((c) => c.employeeId === employeeId) : cells;

  const approve = useHrMutation(() => api<{ approved: number }>("/hr/attendance/approve", { method: "POST", body: { from, to } }),
    undefined, (r) => toast.success(r.approved ? `Đã duyệt ${r.approved} lượt chấm công` : "Không có lượt chấm công nào cần duyệt (cần đủ giờ vào - ra hoặc nghỉ)"));

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="w-[160px] text-[18px] font-bold">Bảng chấm công</h1>
        <EmployeeSearch employees={all} value={employeeId} onChange={setEmployeeId} />
        <ViewSelect label="Kỳ xem" value="week" onChange={() => undefined} options={[["week", "Theo tuần"]]} />
        <WeekNavigator monday={monday} onChange={setMonday} />
        <PickerPopover open={picking} onOpenChange={(o) => { if (o) setPickMonth(`${from.slice(0, 7)}-01`); setPicking(o); }}
          label="Chọn ngày" icon="Chọn" triggerClassName={WEEK_BTN} align="start">
          <MonthCalendar month={pickMonth} onMonthChange={setPickMonth} selected={from}
            onPick={(d) => { setMonday(mondayOf(parseIso(d))); setPicking(false); }} />
        </PickerPopover>
        <div className="ml-auto flex items-center gap-2">
          <ViewSelect label="Kiểu xem" value={mode} onChange={setMode} icon={<CalendarDays className="size-3.5" />}
            options={[["shift", "Xem theo ca"], ["employee", "Xem theo nhân viên"]]} />
          <button type="button" className={WEEK_BTN} disabled={approve.isPending} onClick={() => approve.mutate(undefined)}>
            <CalendarCheck className="size-4" /> Duyệt chấm công</button>
          <div className="relative">
            <button type="button" aria-label="Thao tác khác" aria-expanded={menu} className={WEEK_BTN} onClick={() => setMenu(!menu)}>
              <Ellipsis className="size-4" /></button>
            {menu && (
              <div className="absolute top-9 right-0 z-30 w-56 rounded-md border bg-white py-1 text-[13px] shadow-lg">
                <Link href="/employees/settings/machine" className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#f3f6fa]">
                  <Fingerprint className="size-4" /> Import file máy chấm công</Link>
                <button type="button" className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-[#f3f6fa]"
                  onClick={() => { setMenu(false); setShiftDialog("list"); }}>Quản lý ca làm việc</button>
              </div>
            )}
          </div>
        </div>
      </div>
      <TimesheetWeekGrid mode={mode} days={days} shifts={shifts} employees={employees} cells={shown}
        onOpen={(shift, date, cell) => setOpen({ shift, date, cell })}
        onAddShift={() => setShiftDialog("new")} onEditShift={setShiftDialog} />
      <TimesheetLegend />
      {open && <AttendanceDialog key={`${open.shift.id}-${open.date}-${open.cell?.employeeId ?? "new"}`} cell={open.cell}
        shift={open.shift} date={open.date} employees={all} onClose={() => setOpen(null)} />}
      {shiftDialog && <ShiftFormDialog shift={typeof shiftDialog === "string" ? undefined : shiftDialog}
        initialMode={shiftDialog === "new" ? "create" : "list"} onClose={() => setShiftDialog(null)} />}
    </div>
  );
}
