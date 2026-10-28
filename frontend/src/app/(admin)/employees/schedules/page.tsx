"use client";

import { useMemo, useState } from "react";
import { FileOutput, UserRound } from "lucide-react";
import { ScheduleAddDialog } from "@/features/hr/schedule-add-dialog";
import { ScheduleDeleteDialog } from "@/features/hr/schedule-delete-dialog";
import { ScheduleImportButton } from "@/features/hr/schedule-import-button";
import { ScheduleWeekGrid } from "@/features/hr/schedule-week-grid";
import { addDays, downloadCsv, hm, isoDate, useAllEmployees, useSchedules, useShifts } from "@/features/hr/hr-queries";
import type { EmployeeRow, ScheduleItem } from "@/features/hr/hr-types";
import { EmployeeSearch, thisMonday, ViewSelect, WEEK_BTN, WeekNavigator, weekDays } from "@/features/hr/week-toolbar";

/** Lịch làm việc (ảnh KiotViet 112): lưới tuần theo nhân viên hoặc theo ca, Lương dự kiến, Import / Xuất file. */
export default function SchedulesPage() {
  const [monday, setMonday] = useState(thisMonday);
  const [employeeId, setEmployeeId] = useState("");
  const [mode, setMode] = useState<"employee" | "shift">("employee");
  const [adding, setAdding] = useState<{ employee: EmployeeRow; date: string } | null>(null);
  const [removing, setRemoving] = useState<ScheduleItem | null>(null);
  const days = useMemo(() => weekDays(monday), [monday]);
  const from = isoDate(monday);
  const to = isoDate(addDays(monday, 6));
  const { data: all = [] } = useAllEmployees();
  const { data: shifts = [] } = useShifts();
  const { data } = useSchedules(from, to);
  const employees = employeeId ? all.filter((e) => e.id === employeeId) : all;

  const shiftName = (id: string) => shifts.find((s) => s.id === id);
  const removeTitle = (i: ScheduleItem) => {
    const s = shiftName(i.shiftId);
    return `${all.find((e) => e.id === i.employeeId)?.name ?? "Nhân viên"} · ${s ? `${s.name} (${hm(s.startTime)} - ${hm(s.endTime)})` : "Ca"}`;
  };

  function exportFile() {
    const head = ["Mã nhân viên", "Tên nhân viên", ...days.map((d) => `${d.label} ${d.iso.split("-").reverse().join("/")}`), "Lương dự kiến"];
    const rows = employees.map((e) => [e.code, e.name, ...days.map((d) => (data?.items ?? [])
      .filter((i) => i.employeeId === e.id && i.date === d.iso)
      .map((i) => { const s = shiftName(i.shiftId); return s ? `${s.name} ${hm(s.startTime)}-${hm(s.endTime)}` : ""; }).join("; ")),
      data && e.id in data.expected ? data.expected[e.id] : "Chưa thiết lập lương"]);
    downloadCsv(`lich-lam-viec-${from}.csv`, [head, ...rows]);
  }

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="w-[160px] text-[18px] font-bold">Lịch làm việc</h1>
        <EmployeeSearch employees={all} value={employeeId} onChange={setEmployeeId} />
        <WeekNavigator monday={monday} onChange={setMonday} />
        <button type="button" className={WEEK_BTN} onClick={() => setMonday(thisMonday())}>Tuần này</button>
        <div className="ml-auto flex items-center gap-2">
          <ViewSelect label="Kiểu xem" value={mode} onChange={setMode} icon={<UserRound className="size-3.5" />}
            options={[["employee", "Xem theo nhân viên"], ["shift", "Xem theo ca"]]} />
          <ScheduleImportButton />
          <button type="button" className={WEEK_BTN} onClick={exportFile}><FileOutput className="size-4" /> Xuất file</button>
        </div>
      </div>
      <ScheduleWeekGrid mode={mode} days={days} employees={employees} shifts={shifts} data={data}
        onAdd={(employee, date) => setAdding({ employee, date })} onRemove={setRemoving} />
      {adding && <ScheduleAddDialog employee={adding.employee} date={adding.date} employees={all} onClose={() => setAdding(null)} />}
      {removing && <ScheduleDeleteDialog item={removing} title={removeTitle(removing)} onClose={() => setRemoving(null)} />}
    </div>
  );
}
