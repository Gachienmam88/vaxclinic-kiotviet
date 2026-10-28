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
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { hrNs } from "@/messages/hr";

/** Tạm ứng lương: tăng "Nợ và tạm ứng", tạo phiếu chi "Chi tạm ứng lương nhân viên" trong Sổ quỹ; trừ khi thanh toán lương. */
export function EmployeeAdvanceDialog({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  const t = useT(hrNs);
  const tc = useT(commonNs);
  const { data: branches = [] } = useBranches();
  const [amount, setAmount] = useState(0);
  const [fund, setFund] = useState<"CASH" | "BANK">("CASH");
  const [branchId, setBranchId] = useState(employee.mainBranchId ?? "");
  const [note, setNote] = useState("");
  const save = useHrMutation(() => api(`/hr/employees/${employee.id}/advances`, {
    method: "POST", body: { amount, fund, branchId: branchId || null, note },
  }), t("advance.toastSaved"), onClose);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{t("advance.title", { name: employee.name })}</DialogTitle></DialogHeader>
        <p className="text-[13px]">{t("advance.currentDebt")} <b>{formatMoney(employee.debt)}</b></p>
        <div className="space-y-2.5">
          <HrField label={t("advance.amount")}><MoneyInput autoFocus value={amount} onChange={setAmount} /></HrField>
          <HrField label={t("advance.fund")}>
            <select className={hrInput} value={fund} onChange={(e) => setFund(e.target.value as "CASH" | "BANK")}>
              <option value="CASH">{t("fund.cash")}</option><option value="BANK">{t("fund.bank")}</option>
            </select>
          </HrField>
          <HrField label={t("advance.branch")}>
            <select className={hrInput} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">{t("advance.pickBranch")}</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </HrField>
          <HrField label={tc("fields.note")}><input className={hrInput} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} /></HrField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{tc("actions.skip")}</Button>
          <Button disabled={amount <= 0 || !branchId || save.isPending} onClick={() => save.mutate(undefined)}>{t("advance.submit")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
