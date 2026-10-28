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

const btn = "flex h-[30px] items-center gap-1 rounded-md border bg-white px-2.5 text-[13px] font-semibold disabled:opacity-50";

/** Chi tiết bảng lương: phiếu lương từng nhân viên, tính lại / chốt / hủy, thanh toán, lịch sử thanh toán. */
export default function PayrollDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error } = usePayroll(id);
  const [paying, setPaying] = useState(false);
  const action = useHrMutation((path: string) => api<PayrollDetail>(`/hr/payrolls/${id}/${path}`, { method: "POST" }), "Đã cập nhật bảng lương");

  if (isLoading) return <p className="p-6 text-[13px] text-muted-foreground">Đang tải...</p>;
  if (!data) return <p className="p-6 text-[13px] text-destructive">{error ? "Không tìm thấy bảng lương" : ""}</p>;
  const p = data.payroll;
  const activePayments = data.payments.some((x) => !x.cancelled);
  const run = (path: string, ask?: string) => { if (!ask || confirm(ask)) action.mutate(path); };
  const exportCsv = () => downloadCsv(`${p.code}.csv`, [
    ["Mã NV", "Tên nhân viên", "Loại lương", "Số công", "Lương chính", "Làm thêm", "Ngày lễ", "Phụ cấp", "Hoa hồng", "Thưởng",
      "Giảm trừ", "BHXH", "Thuế TNCN", "Tổng lương", "Đã trả", "Còn cần trả"],
    ...data.payslips.map((s) => [s.employeeCode, s.employeeName, salaryTypeLabel(s.salaryType), s.workUnits, s.baseAmount, s.overtimeAmount,
      s.holidayAmount, s.allowance, s.commission, s.bonus, s.deduction, s.insurance, s.tax, s.total, s.paid, s.total - s.paid]),
  ]);

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <Link href="/employees/payrolls" aria-label="Quay lại" className="flex size-8 items-center justify-center rounded-md hover:bg-white">
          <ArrowLeft className="size-4" /></Link>
        <h1 className="text-[18px] font-bold">{p.name}</h1>
        <PayrollStatusBadge status={p.status} />
        <div className="ml-auto flex gap-2">
          {p.status === "TEMP" && <>
            <button type="button" className={`${btn} border-[#d9dbe0] hover:border-primary hover:text-primary`} disabled={action.isPending}
              onClick={() => run("recalculate")}><Calculator className="size-4" /> Tính lại</button>
            <button type="button" className={`${btn} border-primary bg-primary text-white hover:bg-primary/90`} disabled={action.isPending}
              onClick={() => run("lock", "Chốt bảng lương? Sau khi chốt không tính lại được, chỉ có thể thanh toán.")}>
              <Lock className="size-4" /> Chốt lương</button>
          </>}
          {p.status === "LOCKED" && (
            <button type="button" className={`${btn} border-primary bg-primary text-white hover:bg-primary/90`} onClick={() => setPaying(true)}>
              <Wallet className="size-4" /> Thanh toán</button>
          )}
          {p.status !== "CANCELLED" && !activePayments && (
            <button type="button" className={`${btn} border-[#d9dbe0] text-destructive hover:border-destructive`} disabled={action.isPending}
              onClick={() => run("cancel", `Hủy ${p.code}?`)}><Ban className="size-4" /> Hủy</button>
          )}
          <button type="button" className={`${btn} border-[#d9dbe0] hover:border-primary hover:text-primary`} onClick={exportCsv}>
            <LogOut className="size-4" /> Xuất file</button>
        </div>
      </div>
      <div className="grid grid-cols-5 gap-4 rounded-lg bg-white px-4 py-3 text-[13px]">
        <Info label="Mã bảng lương" value={p.code} />
        <Info label="Kỳ hạn trả" value="Hàng tháng" />
        <Info label="Kỳ làm việc" value={`${dmy(p.periodStart)} - ${dmy(p.periodEnd)}`} />
        <Info label="Người tạo" value={`${p.createdByName ?? ""} · ${formatDateTime(p.createdAt)}`} />
        <Info label="Tính lương lúc" value={formatDateTime(p.computedAt)} />
        <Info label="Tổng lương" value={formatMoney(p.total)} strong />
        <Info label="Đã trả nhân viên" value={formatMoney(p.paid)} strong />
        <Info label="Còn cần trả" value={formatMoney(p.remaining)} strong />
        <Info label="Số nhân viên" value={String(data.payslips.length)} />
        <Info label="Chốt lương lúc" value={formatDateTime(p.lockedAt)} />
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
