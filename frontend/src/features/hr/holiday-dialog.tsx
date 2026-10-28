"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Holiday } from "./hr-types";
import { DatePicker } from "@/components/ui/date-picker";

/** Thêm / sửa kỳ lễ tết: tên, từ ngày, đến hết ngày, hệ số lương (%) áp cho ca làm trong kỳ. */
export function HolidayDialog({ holiday, onSave, onClose, pending }: {
  holiday?: Holiday; onSave: (h: Holiday) => void; onClose: () => void; pending: boolean;
}) {
  const [h, setH] = useState<Holiday>(holiday ?? { name: "", from: "", to: "", multiplier: 200 });
  const invalid = !h.name.trim() || !h.from || !h.to || h.to < h.from || h.multiplier < 0;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{holiday ? "Sửa kỳ lễ tết" : "Thêm kỳ lễ tết"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-[120px_1fr] items-center gap-3 text-[13px]">
          <label htmlFor="hol-name">Tên kỳ lễ tết</label>
          <Input id="hol-name" value={h.name} placeholder="VD: Quốc khánh 2/9" onChange={(e) => setH({ ...h, name: e.target.value })} />
          <label htmlFor="hol-from">Từ ngày</label>
          <DatePicker id="hol-from" value={h.from} onChange={(v) => setH({ ...h, from: v, to: h.to || v })} />
          <label htmlFor="hol-to">Đến hết ngày</label>
          <DatePicker id="hol-to" value={h.to} onChange={(v) => setH({ ...h, to: v })} />
          <label htmlFor="hol-mult">Hệ số lương</label>
          <div className="flex items-center gap-2">
            <Input id="hol-mult" type="number" min={0} className="w-24 text-right" value={h.multiplier}
              onChange={(e) => setH({ ...h, multiplier: Number(e.target.value) })} /> % lương ngày thường
          </div>
        </div>
        {h.from && h.to && h.to < h.from && <p className="text-[13px] text-destructive">Ngày kết thúc phải sau ngày bắt đầu</p>}
        <p className="text-xs text-muted-foreground">VD 300%: làm việc ngày lễ được trả gấp 3 lương ngày thường (phần chênh lệch ghi vào cột Ngày lễ).</p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Bỏ qua</Button>
          <Button disabled={invalid || pending} onClick={() => onSave({ ...h, name: h.name.trim() })}>Lưu</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
