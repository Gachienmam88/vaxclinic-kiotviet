"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api-client";
import { dmy, useHrMutation } from "./hr-queries";
import type { ScheduleItem } from "./hr-types";

/** Xóa 1 ca trong lịch: chỉ ngày này, hoặc cả các tuần sau (cùng ca, cùng thứ) — DELETE /hr/schedules/{id}?repeat=. */
export function ScheduleDeleteDialog({ item, title, onClose }: { item: ScheduleItem; title: string; onClose: () => void }) {
  const [repeat, setRepeat] = useState(false);
  const remove = useHrMutation(() => api(`/hr/schedules/${item.id}?repeat=${repeat}`, { method: "DELETE" }), "Đã xóa lịch làm việc", onClose);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Xóa lịch làm việc</DialogTitle></DialogHeader>
        <p className="text-[13px]">{title} · {dmy(item.date)}</p>
        <div className="space-y-2 text-[13px]">
          <label className="flex cursor-pointer items-center gap-2">
            <input type="radio" name="del-repeat" className="size-4 accent-primary" checked={!repeat} onChange={() => setRepeat(false)} /> Chỉ xóa ngày này</label>
          <label className="flex cursor-pointer items-center gap-2">
            <input type="radio" name="del-repeat" className="size-4 accent-primary" checked={repeat} onChange={() => setRepeat(true)} />
            Xóa cả các tuần sau (cùng ca, cùng thứ)</label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Bỏ qua</Button>
          <Button variant="destructive" disabled={remove.isPending} onClick={() => remove.mutate(undefined)}>Xóa</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
