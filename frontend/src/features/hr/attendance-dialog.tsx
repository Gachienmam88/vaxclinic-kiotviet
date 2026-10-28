"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { dmy, hm, timeOf, useHrMutation } from "./hr-queries";
import type { AttendanceCell, EmployeeRow, Shift } from "./hr-types";
import { ATTENDANCE_STATUS } from "./hr-types";

const SOURCES: Record<string, string> = { MANUAL: "Thủ công", PHONE: "Điện thoại (QR)", MACHINE: "Máy chấm công", AUTO: "Tự động" };
type Mode = "WORK" | "PAID" | "UNPAID";

/**
 * Chấm công 1 nhân viên × ca × ngày: Đi làm (giờ vào / ra) / Nghỉ có phép / Nghỉ không phép, Đã duyệt, ghi chú.
 * cell: ô có sẵn (đã xếp lịch hoặc đã chấm). Không có cell → chấm công không cần xếp lịch: chọn nhân viên.
 */
export function AttendanceDialog({ cell, shift, date, employees, onClose }: {
  cell?: AttendanceCell; shift: Shift; date: string; employees: EmployeeRow[]; onClose: () => void;
}) {
  const [employeeId, setEmployeeId] = useState(cell?.employeeId ?? "");
  const [mode, setMode] = useState<Mode>(cell?.absence ?? "WORK");
  const [checkIn, setCheckIn] = useState(timeOf(cell?.checkIn ?? null) || (cell?.checkOut ? "" : hm(shift.startTime)));
  const [checkOut, setCheckOut] = useState(timeOf(cell?.checkOut ?? null) || (cell?.checkIn ? "" : hm(shift.endTime)));
  const [approved, setApproved] = useState(cell?.approved ?? false);
  const [note, setNote] = useState(cell?.note ?? "");
  const [q, setQ] = useState("");

  const save = useHrMutation(() => api<AttendanceCell>("/hr/attendance", {
    method: "PUT",
    body: {
      employeeId, shiftId: shift.id, date, absence: mode === "WORK" ? null : mode, approved, note: note.trim() || null,
      checkIn: mode === "WORK" && checkIn ? checkIn : null, checkOut: mode === "WORK" && checkOut ? checkOut : null,
    },
  }), "Đã lưu chấm công", onClose);
  const remove = useHrMutation(() => api(`/hr/attendance/${cell?.attendanceId}`, { method: "DELETE" }), "Đã xóa chấm công", onClose);

  const term = q.trim().toLowerCase();
  const list = employees.filter((e) => e.status === "WORKING" && (!term || `${e.code} ${e.name}`.toLowerCase().includes(term))).slice(0, 50);
  const status = cell ? ATTENDANCE_STATUS[cell.status] : null;
  const radio = (v: Mode, label: string) => (
    <label className="flex cursor-pointer items-center gap-2">
      <input type="radio" name="att-mode" className="size-4 accent-primary" checked={mode === v} onChange={() => setMode(v)} /> {label}
    </label>
  );
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Chấm công</DialogTitle></DialogHeader>
        <div className="space-y-3 text-[13px]">
          <p><span className="font-semibold">{cell ? cell.employeeName : "Chấm công không cần xếp lịch"}</span>
            <span className="text-muted-foreground"> · {shift.name} ({hm(shift.startTime)} - {hm(shift.endTime)}) · {dmy(date)}</span></p>
          {!cell && (
            <div className="space-y-1.5">
              <Input className="h-8" placeholder="Tìm nhân viên theo mã, tên" value={q} onChange={(e) => setQ(e.target.value)} />
              <div className="max-h-32 overflow-y-auto rounded-md border">
                {list.map((e) => (
                  <button key={e.id} type="button" onClick={() => setEmployeeId(e.id)}
                    className={cn("block w-full px-2.5 py-1 text-left hover:bg-[#f3f6fa]", employeeId === e.id && "bg-[#e5f0ff] text-primary")}>
                    {e.name} <span className="text-muted-foreground">{e.code}</span></button>
                ))}
                {!list.length && <p className="px-2.5 py-1 text-muted-foreground">Không tìm thấy nhân viên</p>}
              </div>
            </div>
          )}
          {cell && status && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md bg-[#f6f7f9] px-3 py-2 text-[12px]">
              <span className="flex items-center gap-1.5 font-medium"><span className="size-2 rounded-full" style={{ background: status.color }} />{status.label}</span>
              {cell.lateMinutes > 0 && <span>Đi muộn {cell.lateMinutes} phút</span>}
              {cell.earlyMinutes > 0 && <span>Về sớm {cell.earlyMinutes} phút</span>}
              {cell.otMinutes > 0 && <span>Làm thêm {cell.otMinutes} phút</span>}
              {cell.workedMinutes > 0 && <span>Làm việc {Math.floor(cell.workedMinutes / 60)}h{String(cell.workedMinutes % 60).padStart(2, "0")}</span>}
              {cell.source && <span className="text-muted-foreground">Nguồn: {SOURCES[cell.source] ?? cell.source}</span>}
            </div>
          )}
          <div className="flex gap-4">{radio("WORK", "Đi làm")}{radio("PAID", "Nghỉ có phép")}{radio("UNPAID", "Nghỉ không phép")}</div>
          {mode === "WORK" && (
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1.5"><span className="font-medium">Giờ vào</span>
                <Input type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} /></label>
              <label className="grid gap-1.5"><span className="font-medium">Giờ ra</span>
                <Input type="time" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} /></label>
            </div>
          )}
          <label className="grid gap-1.5"><span className="font-medium">Ghi chú</span>
            <Input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} /></label>
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" className="size-4 accent-primary" checked={approved} onChange={(e) => setApproved(e.target.checked)} />
            Đã duyệt <span className="text-muted-foreground">(chỉ chấm công đã duyệt được tính lương)</span>
          </label>
        </div>
        <DialogFooter>
          {cell?.attendanceId && (
            <Button variant="outline" className="mr-auto text-destructive" disabled={remove.isPending}
              onClick={() => { if (confirm("Xóa dữ liệu chấm công của ca này?")) remove.mutate(undefined); }}>Xóa chấm công</Button>
          )}
          <Button variant="outline" onClick={onClose}>Bỏ qua</Button>
          <Button disabled={!employeeId || save.isPending || (mode === "WORK" && !checkIn && !checkOut)} onClick={() => save.mutate(undefined)}>Lưu</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
