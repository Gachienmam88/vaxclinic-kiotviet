"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Ban, Calculator, Lock, LogOut, Wallet } from "lucide-react";
import { dmy, downloadCsv, useHrMutation, usePayroll } from "@/features/hr/hr-queries";
import { salaryTypeLabel, type PayrollDetail } from "@/features/hr/hr-types";
import { PayrollPayDialog } from "@/features/hr/payroll-pay-dialog";
import { PayrollPaymentHistory } from "@/features/hr/payroll-payment-history";
import { PayrollPayslipTable } from "@/features/hr/payroll-payslip-table";
import { PayrollStatusBadge } from "@/features/hr/payroll-ui-parts";
import { api } from "@/lib/api-client";
import { formatDateTime, formatMoney } from "@/lib/format";
import { MONEY_COLS } from "@/features/hr/payroll-payslip-table";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { hrNs } from "@/messages/hr";

const btn = "flex h-[30px] items-center gap-1 rounded-md border bg-white px-2.5 text-[13px] font-semibold disabled:opacity-50";

/** Chi tiết bảng lương: phiếu lương từng nhân viên, tính lại / chốt / hủy, thanh toán, lịch sử thanh toán. */
export default function PayrollDetailPage() {
  const t = useT(hrNs);
  const tc = useT(commonNs);
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error } = usePayroll(id);
  const [paying, setPaying] = useState(false);
  const action = useHrMutation((path: string) => api<PayrollDetail>(`/hr/payrolls/${id}/${path}`, { method: "POST" }), t("payrollDetail.toastUpdated"));

  if (isLoading) return <p className="p-6 text-[13px] text-muted-foreground">{tc("status.loading")}</p>;
  if (!data) return <p className="p-6 text-[13px] text-destructive">{error ? t("payrollDetail.notFound") : ""}</p>;
  const p = data.payroll;
  const activePayments = data.payments.some((x) => !x.cancelled);
  const run = (path: string, ask?: string) => { if (!ask || confirm(ask)) action.mutate(path); };
  const exportCsv = () => downloadCsv(`${p.code}.csv`, [
    [t("payslipCols.code"), t("employee.name"), t("salaryTab.salaryType"), t("payslipCols.workUnits"), ...MONEY_COLS.map(([, l]) => t(l)),
      t("payslipCols.remaining")],
    ...data.payslips.map((s) => [s.employeeCode, s.employeeName, salaryTypeLabel(t, s.salaryType), s.workUnits, s.baseAmount, s.overtimeAmount,
      s.holidayAmount, s.allowance, s.commission, s.bonus, s.deduction, s.insurance, s.tax, s.total, s.paid, s.total - s.paid]),
  ]);

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <Link href="/employees/payrolls" aria-label={tc("actions.back")} className="flex size-8 items-center justify-center rounded-md hover:bg-white">
          <ArrowLeft className="size-4" /></Link>
        <h1 className="text-[18px] font-bold">{p.name}</h1>
        <PayrollStatusBadge status={p.status} />
        <div className="ml-auto flex gap-2">
          {p.status === "TEMP" && <>
            <button type="button" className={`${btn} border-[#d9dbe0] hover:border-primary hover:text-primary`} disabled={action.isPending}
              onClick={() => run("recalculate")}><Calculator className="size-4" /> {t("payrollDetail.recalculate")}</button>
            <button type="button" className={`${btn} border-primary bg-primary text-white hover:bg-primary/90`} disabled={action.isPending}
              onClick={() => run("lock", t("payrollDetail.confirmLock"))}>
              <Lock className="size-4" /> {t("payrollDetail.lock")}</button>
          </>}
          {p.status === "LOCKED" && (
            <button type="button" className={`${btn} border-primary bg-primary text-white hover:bg-primary/90`} onClick={() => setPaying(true)}>
              <Wallet className="size-4" /> {t("pay.submit")}</button>
          )}
          {p.status !== "CANCELLED" && !activePayments && (
            <button type="button" className={`${btn} border-[#d9dbe0] text-destructive hover:border-destructive`} disabled={action.isPending}
              onClick={() => run("cancel", t("payrollDetail.confirmCancel", { code: p.code }))}><Ban className="size-4" /> {t("payrollDetail.cancel")}</button>
          )}
          <button type="button" className={`${btn} border-[#d9dbe0] hover:border-primary hover:text-primary`} onClick={exportCsv}>
            <LogOut className="size-4" /> {tc("actions.export")}</button>
        </div>
      </div>
      <div className="grid grid-cols-5 gap-4 rounded-lg bg-white px-4 py-3 text-[13px]">
        <Info label={t("payrollDetail.code")} value={p.code} />
        <Info label={t("payrollCreate.payCycle")} value={t("payrollCreate.monthly")} />
        <Info label={t("payrollCreate.workPeriod")} value={`${dmy(p.periodStart)} - ${dmy(p.periodEnd)}`} />
        <Info label={t("payments.cols.createdBy")} value={`${p.createdByName ?? ""} · ${formatDateTime(p.createdAt)}`} />
        <Info label={t("payrollDetail.computedAt")} value={formatDateTime(p.computedAt)} />
        <Info label={t("payslipCols.total")} value={formatMoney(p.total)} strong />
        <Info label={t("payrolls.paidToEmployees")} value={formatMoney(p.paid)} strong />
        <Info label={t("payslipCols.remaining")} value={formatMoney(p.remaining)} strong />
        <Info label={t("payrollDetail.employeeCount")} value={String(data.payslips.length)} />
        <Info label={t("payrollDetail.lockedAt")} value={formatDateTime(p.lockedAt)} />
      </div>
      <PayrollPayslipTable detail={data} />
      <PayrollPaymentHistory payments={data.payments} />
      {paying && <PayrollPayDialog detail={data} onClose={() => setPaying(false)} />}
    </div>
  );
}

function Info({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className={strong ? "font-bold" : ""}>{value || "—"}</p></div>;
}
