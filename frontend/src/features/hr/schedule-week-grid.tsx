"use client";

import { Info, Plus, X } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { hm } from "./hr-queries";
import type { EmployeeRow, ScheduleItem, ScheduleWeek, Shift } from "./hr-types";
import { DayHeader, todayIso } from "./week-toolbar";
import { DocCodeLink } from "@/components/ui/doc-code-link";

type Day = { iso: string; day: number; label: string };

const HEAD = "h-[33px] border-b border-r border-[#e5e7eb] bg-white px-2 text-center last:border-r-0";
const CELL = "group relative h-[51px] border-r border-b border-[#e5e7eb] p-1 align-top last:border-r-0";

/** Chip 1 ca trong ô lịch: tên ca + giờ, nút x để xóa. */
function ShiftChip({ title, sub, onRemove }: { title: string; sub: string; onRemove: () => void }) {
  return (
    <div className="mb-1 flex items-start gap-1 rounded bg-primary-tint px-1.5 py-0.5 text-[11px] leading-4 text-primary">
      <span className="min-w-0 flex-1 truncate"><span className="font-semibold">{title}</span> <span className="text-foreground/70">{sub}</span></span>
      <button type="button" aria-label={`Xóa ${title}`} onClick={onRemove} className="opacity-0 group-hover:opacity-100 hover:text-destructive">
        <X className="size-3" /></button>
    </div>
  );
}

function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" aria-label={label} onClick={onClick}
      className="absolute right-1 bottom-1 flex size-5 items-center justify-center rounded border border-primary bg-white text-primary opacity-0 group-hover:opacity-100">
      <Plus className="size-3.5" /></button>
  );
}

/**
 * Lưới Lịch làm việc (ảnh KiotViet 112). mode "employee": dòng = nhân viên, cột cuối Lương dự kiến;
 * mode "shift": dòng = ca làm việc, ô = tên nhân viên được xếp.
 */
export function ScheduleWeekGrid({ mode, days, employees, shifts, data, onAdd, onRemove }: {
  mode: "employee" | "shift"; days: Day[]; employees: EmployeeRow[]; shifts: Shift[]; data?: ScheduleWeek;
  onAdd: (employee: EmployeeRow, date: string) => void; onRemove: (item: ScheduleItem) => void;
}) {
  const today = todayIso();
  const items = data?.items ?? [];
  const shiftOf = (id: string) => shifts.find((s) => s.id === id);
  const empOf = (id: string) => employees.find((e) => e.id === id);
  const shownIds = new Set(employees.map((e) => e.id));
  const totalExpected = employees.reduce((s, e) => s + Number(data?.expected[e.id] ?? 0), 0);
  return (
    <div className="min-h-[466px] overflow-x-auto rounded-lg bg-white">
      <table className="w-full min-w-[1000px] table-fixed border-collapse text-[12px]">
        <colgroup><col className="w-[117px]" />{days.map((d) => <col key={d.iso} />)}{mode === "employee" && <col className="w-[117px]" />}</colgroup>
        <thead>
          <tr>
            <th className={cn(HEAD, "h-[33px] text-left font-semibold")}>{mode === "employee" ? "Nhân viên" : "Ca làm việc"}</th>
            {days.map((d) => <th key={d.iso} className={HEAD}><DayHeader label={d.label} day={d.day} today={d.iso === today} /></th>)}
            {mode === "employee" && (
              <th className={cn(HEAD, "text-right font-semibold")}>
                <span className="inline-flex items-center gap-1">Lương dự kiến
                  <span title="Lương cơ bản nếu nhân viên làm đủ các ca đã xếp trong tuần (đã nhân hệ số ngày lễ)"><Info className="size-3 text-muted-foreground" /></span>
                </span>
              </th>
            )}
          </tr>
          {mode === "employee" && (
            <tr><td colSpan={days.length + 1} className="h-[25px] border-b border-[#e5e7eb]" />
              <td className="border-b border-[#e5e7eb] px-2 text-right text-[13px] font-bold">{formatMoney(totalExpected)}</td></tr>
          )}
        </thead>
        <tbody>
          {mode === "employee" && employees.map((e) => (
            <tr key={e.id}>
              <td className="border-r border-b border-[#e5e7eb] px-2 py-1.5 align-top leading-4">
                <p className="truncate font-semibold uppercase">{e.name}</p>
                <p className="text-[11px]"><DocCodeLink code={e.code} /></p>
                {e.departmentName && <p className="truncate text-[11px] text-primary uppercase">{e.departmentName}</p>}
              </td>
              {days.map((d) => (
                <td key={d.iso} className={CELL}>
                  {items.filter((i) => i.employeeId === e.id && i.date === d.iso).map((i) => {
                    const s = shiftOf(i.shiftId);
                    return <ShiftChip key={i.id} title={s?.name ?? "Ca"} sub={s ? `${hm(s.startTime)}-${hm(s.endTime)}` : ""} onRemove={() => onRemove(i)} />;
                  })}
                  {e.status === "WORKING" && <AddButton label={`Thêm lịch ${e.name} ngày ${d.iso}`} onClick={() => onAdd(e, d.iso)} />}
                </td>
              ))}
              <td className="border-b border-[#e5e7eb] px-2 py-1.5 text-right align-top">
                {data && e.id in data.expected ? <span className="font-semibold">{formatMoney(data.expected[e.id])}</span>
                  : <span className="text-[10px] text-muted-foreground">Chưa thiết lập lương</span>}
              </td>
            </tr>
          ))}
          {mode === "shift" && shifts.filter((s) => s.active || items.some((i) => i.shiftId === s.id)).map((s) => (
            <tr key={s.id}>
              <td className="border-r border-b border-[#e5e7eb] px-2 py-1.5 align-top leading-4">
                <p className="font-semibold">{s.name}</p><p className="text-[11px] text-muted-foreground">{hm(s.startTime)} - {hm(s.endTime)}</p>
              </td>
              {days.map((d) => (
                <td key={d.iso} className={CELL}>
                  {items.filter((i) => i.shiftId === s.id && i.date === d.iso && shownIds.has(i.employeeId)).map((i) => {
                    const emp = empOf(i.employeeId);
                    return <ShiftChip key={i.id} title={emp?.name ?? "Nhân viên"} sub={emp?.code ?? ""} onRemove={() => onRemove(i)} />;
                  })}
                </td>
              ))}
            </tr>
          ))}
          {mode === "employee" && !employees.length && (
            <tr><td colSpan={days.length + 2} className="py-10 text-center text-muted-foreground">Chưa có nhân viên đang làm việc</td></tr>
          )}
          {mode === "shift" && !shifts.length && (
            <tr><td colSpan={days.length + 1} className="py-10 text-center text-muted-foreground">Chưa có ca làm việc</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
