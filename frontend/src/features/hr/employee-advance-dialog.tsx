"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useBranches } from "@/features/settings/settings-queries";
import { api } from "@/lib/api-client";
import { formatMoney } from "@/lib/format";
import { HrField, MoneyInput, hrInput } from "./hr-form-ui";
import { useHrMutation } from "./hr-queries";
import type { Employee } from "./hr-types";

/** Tạm ứng lương: tăng "Nợ và tạm ứng", tạo phiếu chi "Chi tạm ứng lương nhân viên" trong Sổ quỹ; trừ khi thanh toán lương. */
export function EmployeeAdvanceDialog({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  const { data: branches = [] } = useBranches();
  const [amount, setAmount] = useState(0);
  const [fund, setFund] = useState<"CASH" | "BANK">("CASH");
  const [branchId, setBranchId] = useState(employee.mainBranchId ?? "");
  const [note, setNote] = useState("");
  const save = useHrMutation(() => api(`/hr/employees/${employee.id}/advances`, {
    method: "POST", body: { amount, fund, branchId: branchId || null, note },
  }), "Đã ghi nhận tạm ứng và tạo phiếu chi", onClose);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Tạm ứng lương - {employee.name}</DialogTitle></DialogHeader>
        <p className="text-[13px]">Nợ và tạm ứng hiện tại: <b>{formatMoney(employee.debt)}</b></p>
        <div className="space-y-2.5">
          <HrField label="Số tiền tạm ứng"><MoneyInput autoFocus value={amount} onChange={setAmount} /></HrField>
          <HrField label="Hình thức chi">
            <select className={hrInput} value={fund} onChange={(e) => setFund(e.target.value as "CASH" | "BANK")}>
              <option value="CASH">Tiền mặt</option><option value="BANK">Chuyển khoản</option>
            </select>
          </HrField>
          <HrField label="Chi nhánh chi">
            <select className={hrInput} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">Chọn chi nhánh</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </HrField>
          <HrField label="Ghi chú"><input className={hrInput} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} /></HrField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Bỏ qua</Button>
          <Button disabled={amount <= 0 || !branchId || save.isPending} onClick={() => save.mutate(undefined)}>Tạm ứng</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
