"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { hrNs } from "@/messages/hr";
import { WEEKDAY_LONG } from "./hr-types";

/** Sửa ngày làm việc trong tuần của 1 chi nhánh (1 = Thứ hai … 7 = Chủ nhật). */
export function WorkdaysBranchDialog({ branchName, days, onSave, onClose, pending }: {
  branchName: string; days: number[]; onSave: (days: number[]) => void; onClose: () => void; pending: boolean;
}) {
  const t = useT(hrNs);
  const tc = useT(commonNs);
  const [value, setValue] = useState(days);
  const toggle = (d: number, on: boolean) => setValue(on ? [...value, d].sort((a, b) => a - b) : value.filter((x) => x !== d));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{t("workdays.dialogTitle", { branch: branchName })}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-4 gap-3 text-[13px]">
          {WEEKDAY_LONG.map((label, i) => (
            <label key={label} className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" className="size-4 accent-primary" checked={value.includes(i + 1)} onChange={(e) => toggle(i + 1, e.target.checked)} />
              {t(label)}
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{t("workdays.dialogHint")}</p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{tc("actions.skip")}</Button>
          <Button disabled={!value.length || pending} onClick={() => onSave(value)}>{tc("actions.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
