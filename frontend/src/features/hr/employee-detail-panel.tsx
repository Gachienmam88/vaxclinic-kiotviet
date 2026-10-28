"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DETAIL_BTN, DETAIL_PANEL, SUB_HEAD } from "@/features/sales/invoice-list-kit";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { EmployeeAdvanceDialog } from "./employee-advance-dialog";
import { EmployeeFormDialog } from "./employee-form-dialog";
import { useEmployee, useHrMutation } from "./hr-queries";
import { salaryTypeLabel, type AdvanceItem, type Employee } from "./hr-types";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { hrNs } from "@/messages/hr";

const Info = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="grid grid-cols-[140px_minmax(0,1fr)] border-b border-dashed border-[#e5e7eb] py-1.5">
    <span className="text-muted-foreground">{label}</span><span>{value || "—"}</span>
  </div>
);

/** Panel chi tiết mở dưới dòng nhân viên: thông tin, thiết lập lương, lịch sử tạm ứng; nút sửa / tạm ứng / nghỉ việc / xóa. */
export function EmployeeDetailPanel({ id }: { id: string }) {
  const t = useT(hrNs);
  const tc = useT(commonNs);
  const { data: e } = useEmployee(id);
  const { data: advances = [] } = useQuery({ queryKey: ["hr", "advances", id], queryFn: () => api<AdvanceItem[]>(`/hr/employees/${id}/advances`) });
  const [editing, setEditing] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const toggle = useHrMutation((emp: Employee) => api(`/hr/employees/${emp.id}`, { method: "PUT", body: {
    ...emp, branchIds: emp.branches.map((b) => b.id), status: emp.status === "WORKING" ? "QUIT" : "WORKING",
  } }), t("employeeDetail.toastStatus"));
  const remove = useHrMutation((emp: Employee) => api(`/hr/employees/${emp.id}`, { method: "DELETE" }), t("employeeDetail.toastDeleted"));
  if (!e) return <div className={`${DETAIL_PANEL} p-4`}>{tc("status.loading")}</div>;
  return (
    <div className={`${DETAIL_PANEL} space-y-4 p-4`}>
      <div className="grid grid-cols-2 gap-x-8">
        <div>
          <Info label={t("employee.code")} value={e.code} /><Info label={t("employee.timekeepingCode")} value={e.timekeepingCode} />
          <Info label={t("employee.name")} value={<b>{e.name}</b>} /><Info label={t("employee.birthday")} value={formatDate(e.birthday)} />
          <Info label={t("employee.gender")} value={e.gender === "MALE" ? t("employee.male") : e.gender === "FEMALE" ? t("employee.female") : ""} />
          <Info label={t("employee.idNumber")} value={e.idNumber} /><Info label={t("employee.phone")} value={e.phone} />
          <Info label={t("employee.account")} value={e.username} />
        </div>
        <div>
          <Info label={t("catalog.department")} value={e.departmentName} /><Info label={t("catalog.jobTitle")} value={e.jobTitleName} />
          <Info label={t("employee.branches")} value={e.branches.map((b) => b.name).join(", ")} />
          <Info label={t("employee.startDate")} value={formatDate(e.startDate)} />
          {e.endDate && <Info label={t("employee.endDate")} value={formatDate(e.endDate)} />}
          <Info label={t("salaryTab.salaryType")} value={e.salaryType ? `${salaryTypeLabel(t, e.salaryType)}: ${formatMoney(e.salaryAmount)}` : t("salaryTab.noSalary")} />
          <Info label={t("payslip.commission")} value={e.commissionTableName} />
          <Info label={t("employeeDetail.payItems")} value={t("employeeDetail.payItemsCount", { allowances: e.allowances.length, deductions: e.deductions.length })} />
          <Info label={t("employee.debt")} value={<b>{formatMoney(e.debt)}</b>} />
        </div>
      </div>
      {advances.length > 0 && (
        <table className="w-full text-[13px]">
          <thead className={SUB_HEAD}><tr><th>{t("payments.cols.time")}</th><th>{t("employeeDetail.advanceKind")}</th><th className="text-right">{t("payItems.amount")}</th><th>{tc("fields.note")}</th></tr></thead>
          <tbody>{advances.slice(0, 10).map((a) => (
            <tr key={a.id} className={`border-b [&_td]:h-8 [&_td]:px-2 ${a.cancelled ? "text-muted-foreground line-through" : ""}`}>
              <td>{formatDateTime(a.occurredAt)}</td><td>{a.kind === "ADVANCE" ? t("employeeDetail.advance") : t("employeeDetail.salaryDeduct")}</td>
              <td className="text-right">{formatMoney(a.amount)}</td><td>{a.note}</td>
            </tr>))}
          </tbody>
        </table>
      )}
      <div className="flex justify-end gap-2">
        <Button className={DETAIL_BTN} onClick={() => setEditing(true)}>{t("employeeDetail.edit")}</Button>
        <Button variant="outline" className={DETAIL_BTN} onClick={() => setAdvancing(true)}>{t("advance.submit")}</Button>
        <Button variant="outline" className={DETAIL_BTN} disabled={toggle.isPending} onClick={() => toggle.mutate(e)}>
          {e.status === "WORKING" ? t("employeeDetail.deactivate") : t("employeeDetail.reactivate")}
        </Button>
        <Button variant="outline" className={`${DETAIL_BTN} text-destructive`} disabled={remove.isPending}
          onClick={() => window.confirm(t("employeeDetail.confirmDelete", { name: e.name })) && remove.mutate(e)}>{tc("actions.delete")}</Button>
      </div>
      {editing && <EmployeeFormDialog employee={e} onClose={() => setEditing(false)} />}
      {advancing && <EmployeeAdvanceDialog employee={e} onClose={() => setAdvancing(false)} />}
    </div>
  );
}
