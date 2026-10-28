"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useBranches } from "@/features/settings/settings-queries";
import { api } from "@/lib/api-client";
import { payPeriodOf, useHrMutation, useHrSettings } from "./hr-queries";
import type { PayrollDetail } from "./hr-types";
import { DatePicker } from "@/components/ui/date-picker";

const field = "h-[30px] w-full rounded-md border border-[#d9dbe0] bg-white px-2.5 text-[13px] outline-none focus:border-primary";

/** "+ Bảng tính lương": tên (tùy chọn), kỳ hạn trả Hàng tháng, kỳ làm việc (mặc định kỳ lương hiện tại), chi nhánh. */
export function PayrollCreateDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { data: settings } = useHrSettings();
  const { data: branches = [] } = useBranches();
  const def = payPeriodOf(new Date(), settings?.payroll.startDay ?? 1);
  const [name, setName] = useState("");
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [branchId, setBranchId] = useState("");
  const periodFrom = from ?? def.from;
  const periodTo = to ?? def.to;
  const create = useHrMutation(
    () => api<PayrollDetail>("/hr/payrolls", {
      method: "POST", body: { name: name.trim() || null, periodStart: periodFrom, periodEnd: periodTo, branchId: branchId || null },
    }),
    "Đã tạo bảng tính lương",
    (d) => { onClose(); router.push(`/employees/payrolls/${d.payroll.id}`); },
  );
  /** Đổi ngày bắt đầu → tự đặt ngày kết thúc = cuối kỳ 1 tháng. */
  const changeFrom = (v: string) => {
    setFrom(v);
    if (v) {
      const [y, m, d] = v.split("-").map(Number);
      const end = new Date(y, m, d - 1);
      setTo(`${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Thêm bảng tính lương</DialogTitle></DialogHeader>
        <div className="grid grid-cols-[120px_1fr] items-center gap-x-3 gap-y-3 text-[13px]">
          <label htmlFor="pr-name">Tên bảng lương</label>
          <input id="pr-name" className={field} placeholder="Mặc định: Bảng lương tháng ..." value={name} onChange={(e) => setName(e.target.value)} />
          <span>Kỳ hạn trả</span>
          <select className={field} aria-label="Kỳ hạn trả" value="MONTHLY" onChange={() => undefined}><option value="MONTHLY">Hàng tháng</option></select>
          <span>Kỳ làm việc</span>
          <div className="flex items-center gap-2">
            <DatePicker aria-label="Từ ngày" className={field} value={periodFrom} onChange={(v) => changeFrom(v)} />
            <span>-</span>
            <DatePicker aria-label="Đến ngày" className={field} value={periodTo} onChange={(v) => setTo(v)} />
          </div>
          <label htmlFor="pr-branch">Chi nhánh</label>
          <select id="pr-branch" className={field} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">Tất cả chi nhánh</option>
            {branches.filter((b) => b.active).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <p className="text-xs text-muted-foreground">Lương được tính từ các ca chấm công đã duyệt của nhân viên đã thiết lập lương.</p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Bỏ qua</Button>
          <Button disabled={!periodFrom || !periodTo || create.isPending} onClick={() => create.mutate(undefined)}>
            {create.isPending ? "Đang tính lương..." : "Tạo bảng lương"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
