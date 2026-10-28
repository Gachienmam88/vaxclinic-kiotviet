"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api-client";
import { hm, useHrMutation, useShifts } from "./hr-queries";
import type { Shift } from "./hr-types";
import { ShiftFormDialog } from "./shift-form-dialog";

/** "Thiết lập ca làm việc": danh sách ca của cửa hàng, thêm / sửa / xóa (ca đã dùng chỉ ngừng hoạt động). */
export function HrSettingsShiftListDialog({ onClose }: { onClose: () => void }) {
  const { data: shifts = [] } = useShifts();
  const [editing, setEditing] = useState<Shift | "new" | null>(null);
  const remove = useHrMutation((id: string) => api(`/hr/shifts/${id}`, { method: "DELETE" }), "Đã xóa ca làm việc");
  const hours = (m: number) => `${Math.floor(m / 60)} giờ${m % 60 ? ` ${m % 60} phút` : ""}`;
  return (
    <>
      <Dialog open={!editing} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader><DialogTitle>Thiết lập ca làm việc</DialogTitle></DialogHeader>
          <table className="w-full text-[13px]">
            <thead><tr className="bg-[#f0f2f5] text-left [&_th]:h-[32px] [&_th]:px-2 [&_th]:font-semibold">
              <th>Tên ca</th><th>Thời gian</th><th>Tổng giờ</th><th>Trạng thái</th><th />
            </tr></thead>
            <tbody>
              {!shifts.length && <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">Chưa có ca làm việc</td></tr>}
              {shifts.map((s) => (
                <tr key={s.id} className="border-b border-[#eceef1] [&_td]:px-2 [&_td]:py-2">
                  <td className="font-medium">{s.name}</td><td>{hm(s.startTime)} - {hm(s.endTime)}</td><td>{hours(s.minutes)}</td>
                  <td>{s.active ? "Đang hoạt động" : "Ngừng hoạt động"}</td>
                  <td className="text-right whitespace-nowrap">
                    <button type="button" aria-label={`Sửa ${s.name}`} className="mr-2" onClick={() => setEditing(s)}>
                      <Pencil className="size-3.5 hover:text-primary" /></button>
                    <button type="button" aria-label={`Xóa ${s.name}`}
                      onClick={() => confirm(`Xóa ca "${s.name}"? Ca đã xếp lịch / chấm công sẽ chuyển sang ngừng hoạt động.`) && remove.mutate(s.id)}>
                      <Trash2 className="size-3.5 hover:text-destructive" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing("new")}><Plus className="size-4" /> Thêm ca</Button>
            <Button onClick={onClose}>Xong</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {editing && <ShiftFormDialog shift={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  );
}
