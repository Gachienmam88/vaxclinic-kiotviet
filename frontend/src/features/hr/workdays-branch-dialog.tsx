"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WEEKDAY_LONG } from "./hr-types";

/** Sửa ngày làm việc trong tuần của 1 chi nhánh (1 = Thứ hai … 7 = Chủ nhật). */
export function WorkdaysBranchDialog({ branchName, days, onSave, onClose, pending }: {
  branchName: string; days: number[]; onSave: (days: number[]) => void; onClose: () => void; pending: boolean;
}) {
  const [value, setValue] = useState(days);
  const toggle = (d: number, on: boolean) => setValue(on ? [...value, d].sort() : value.filter((x) => x !== d));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Ngày làm việc - {branchName}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-4 gap-3 text-[13px]">
          {WEEKDAY_LONG.map((label, i) => (
            <label key={label} className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" className="size-4 accent-primary" checked={value.includes(i + 1)} onChange={(e) => toggle(i + 1, e.target.checked)} />
              {label}
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Số ngày làm việc trong kỳ là số ngày công chuẩn khi tính lương theo ngày công chuẩn.</p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Bỏ qua</Button>
          <Button disabled={!value.length || pending} onClick={() => onSave(value)}>Lưu</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
