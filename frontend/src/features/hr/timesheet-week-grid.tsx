"use client";

import { Check, CircleCheck, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { hm, timeOf } from "./hr-queries";
import type { AttendanceCell, EmployeeRow, Shift } from "./hr-types";
import { ATTENDANCE_STATUS } from "./hr-types";
import { DayHeader, todayIso } from "./week-toolbar";
import { DocCodeLink } from "@/components/ui/doc-code-link";

type Day = { iso: string; day: number; label: string };

const HEAD = "h-[33px] border-r border-b border-[#e5e7eb] px-2 text-center last:border-r-0";
const CELL = "group relative min-h-[90px] border-r border-b border-[#e5e7eb] p-1 align-top last:border-r-0";

/** Thẻ chấm công nhỏ: chấm màu trạng thái + tên (hoặc tên ca) + giờ vào - ra, dấu ✓ khi đã duyệt. */
function CellCard({ cell, title, onOpen }: { cell: AttendanceCell; title: string; onOpen: () => void }) {
  const st = ATTENDANCE_STATUS[cell.status];
  const times = cell.absence ? (cell.absence === "PAID" ? "Nghỉ có phép" : "Nghỉ không phép")
    : cell.checkIn || cell.checkOut ? `${timeOf(cell.checkIn) || "--:--"} - ${timeOf(cell.checkOut) || "--:--"}` : "";
  return (
    <button type="button" onClick={onOpen} title={st.label}
      className="mb-1 block w-full rounded border border-[#e5e7eb] bg-white px-1.5 py-1 text-left text-[11px] leading-4 hover:border-primary">
      <span className="flex items-center gap-1">
        <span className="size-2 shrink-0 rounded-full" style={{ background: st.color }} />
        <span className="min-w-0 flex-1 truncate font-semibold">{title}</span>
        {cell.approved && <Check className="size-3 shrink-0 text-[#0f9d58]" aria-label="Đã duyệt" />}
      </span>
      {times && <span className="block pl-3 text-muted-foreground">{times}</span>}
    </button>
  );
}

/**
 * Lưới Bảng chấm công (ảnh KiotViet 113). mode "shift": dòng = ca làm việc (nút + tạo ca, bấm tên ca để sửa);
 * mode "employee": dòng = nhân viên. Bấm thẻ để chấm công; "+" trong ô (theo ca) để chấm công nhân viên chưa xếp lịch.
 */
export function TimesheetWeekGrid({ mode, days, shifts, employees, cells, onOpen, onAddShift, onEditShift }: {
  mode: "shift" | "employee"; days: Day[]; shifts: Shift[]; employees: EmployeeRow[]; cells: AttendanceCell[];
  onOpen: (shift: Shift, date: string, cell?: AttendanceCell) => void; onAddShift: () => void; onEditShift: (s: Shift) => void;
}) {
  const today = todayIso();
  const shiftOf = (id: string) => shifts.find((s) => s.id === id);
  const shownShifts = shifts.filter((s) => s.active || cells.some((c) => c.shiftId === s.id));
  const empIds = new Set(employees.map((e) => e.id));
  return (
    <div className="overflow-x-auto rounded-lg bg-white">
      <table className="w-full min-w-[1000px] table-fixed border-collapse text-[12px]">
        <colgroup><col className="w-[102px]" />{days.map((d) => <col key={d.iso} />)}</colgroup>
        <thead>
          <tr>
            <th className={cn(HEAD, "text-left font-semibold")}>
              {mode === "shift" ? (
                <span className="flex items-center justify-between">Ca làm việc
                  <button type="button" aria-label="Thêm ca làm việc" onClick={onAddShift} className="hover:text-primary"><Plus className="size-4" /></button>
                </span>
              ) : "Nhân viên"}
            </th>
            {days.map((d) => <th key={d.iso} className={HEAD}><DayHeader label={d.label} day={d.day} today={d.iso === today} pad /></th>)}
          </tr>
        </thead>
        <tbody>
          {mode === "shift" && shownShifts.map((s) => (
            <tr key={s.id}>
              <td className="border-r border-b border-[#e5e7eb] px-2 py-1.5 align-top leading-4">
                <button type="button" className="text-left hover:text-primary" onClick={() => onEditShift(s)}>
                  <span className="block font-semibold">{s.name}</span>
                  <span className="text-[11px] text-muted-foreground">{hm(s.startTime)} - {hm(s.endTime)}</span>
                </button>
              </td>
              {days.map((d) => (
                <td key={d.iso} className={CELL}>
                  {cells.filter((c) => c.shiftId === s.id && c.date === d.iso && empIds.has(c.employeeId)).map((c) => (
                    <CellCard key={`${c.employeeId}-${c.shiftId}`} cell={c} title={c.employeeName} onOpen={() => onOpen(s, d.iso, c)} />
                  ))}
                  {s.active && (
                    <button type="button" aria-label={`Chấm công ${s.name} ngày ${d.iso}`} onClick={() => onOpen(s, d.iso)}
                      className="flex h-5 w-full items-center justify-center rounded border border-dashed border-primary text-primary opacity-0 group-hover:opacity-100">
                      <Plus className="size-3.5" /></button>
                  )}
                </td>
              ))}
            </tr>
          ))}
          {mode === "employee" && employees.map((e) => (
            <tr key={e.id}>
              <td className="border-r border-b border-[#e5e7eb] px-2 py-1.5 align-top leading-4">
                <p className="truncate font-semibold uppercase">{e.name}</p><p className="text-[11px]"><DocCodeLink code={e.code} /></p>
              </td>
              {days.map((d) => (
                <td key={d.iso} className={CELL}>
                  {cells.filter((c) => c.employeeId === e.id && c.date === d.iso).map((c) => {
                    const s = shiftOf(c.shiftId);
                    return s ? <CellCard key={c.shiftId} cell={c} title={s.name} onOpen={() => onOpen(s, d.iso, c)} /> : null;
                  })}
                </td>
              ))}
            </tr>
          ))}
          {((mode === "shift" && !shownShifts.length) || (mode === "employee" && !employees.length)) && (
            <tr><td className="h-[90px] border-r border-[#e5e7eb]" /><td colSpan={days.length} className="text-center text-muted-foreground">
              {mode === "shift" ? "Chưa có ca làm việc — bấm + để tạo ca" : "Chưa có nhân viên đang làm việc"}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/** Chú thích trạng thái (viên thuốc trắng có bóng, căn giữa dưới lưới). */
export function TimesheetLegend() {
  return (
    <div className="flex justify-center">
      <div className="flex flex-wrap items-center gap-4 rounded-full bg-white px-4 py-1.5 text-[11px] shadow-[0_1px_6px_rgba(0,0,0,0.12)]">
        {Object.values(ATTENDANCE_STATUS).map((s) => (
          <span key={s.label} className="flex items-center gap-1">
            <CircleCheck className="size-3.5 text-white" fill={s.color} strokeWidth={2.5} /> {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
