"use client";

import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { api } from "@/lib/api-client";
import { formatMoney, formatNumber, parseNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useHrMutation } from "./hr-queries";
import { salaryTypeLabel, type Payslip, type PayrollDetail } from "./hr-types";
import { PayslipDetailPanel, unitLabel } from "./payroll-ui-parts";

const MONEY_COLS: [keyof Payslip, string][] = [
  ["baseAmount", "Lương chính"], ["overtimeAmount", "Làm thêm"], ["holidayAmount", "Ngày lễ"], ["allowance", "Phụ cấp"],
  ["commission", "Hoa hồng"], ["bonus", "Thưởng"], ["deduction", "Giảm trừ"], ["insurance", "BHXH"], ["tax", "Thuế TNCN"],
  ["total", "Tổng lương"], ["paid", "Đã trả"],
];

/** Ô "Thưởng" sửa được khi bảng lương Tạm tính: rời ô → lưu và tính lại bảng lương. */
function BonusInput({ payrollId, slip }: { payrollId: string; slip: Payslip }) {
  const [v, setV] = useState(formatMoney(slip.bonus));
  const save = useHrMutation((bonus: number) => api<PayrollDetail>(`/hr/payrolls/${payrollId}/payslips/${slip.id}`, {
    method: "PUT", body: { bonus },
  }), "Đã cập nhật thưởng");
  return (
    <input aria-label={`Thưởng ${slip.employeeName}`} value={v} inputMode="numeric"
      className="h-6 w-20 rounded border border-[#d9dbe0] px-1 text-right outline-none focus:border-primary"
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setV(e.target.value.replace(/[^\d,]/g, ""))}
      onBlur={() => { const n = parseNumber(v); setV(formatMoney(n)); if (n !== Number(slip.bonus)) save.mutate(n); }} />
  );
}

/** Bảng phiếu lương của bảng lương: dòng tổng, mỗi nhân viên 1 dòng, bấm dòng xem diễn giải. */
export function PayrollPayslipTable({ detail }: { detail: PayrollDetail }) {
  const [open, setOpen] = useState<string | null>(null);
  const editable = detail.payroll.status === "TEMP";
  const slips = detail.payslips;
  const sum = (k: keyof Payslip) => slips.reduce((s, p) => s + Number(p[k] ?? 0), 0);
  const th = "h-[34px] px-2 font-semibold whitespace-nowrap";
  return (
    <div className="overflow-x-auto rounded-lg bg-white">
      <table className="w-full text-[13px]">
        <thead><tr className="bg-[#e3f0fc] text-left">
          <th className={cn(th, "w-6")} /><th className={th}>Mã NV</th><th className={th}>Tên nhân viên</th><th className={th}>Loại lương</th>
          <th className={cn(th, "text-right")}>Số công</th>
          {MONEY_COLS.map(([k, l]) => <th key={k} className={cn(th, "text-right")}>{l}</th>)}
          <th className={cn(th, "pr-3 text-right")}>Còn cần trả</th>
        </tr></thead>
        <tbody>
          <tr className="border-b font-bold">
            <td colSpan={5} />
            {MONEY_COLS.map(([k]) => <td key={k} className="px-2 py-2 text-right">{formatMoney(sum(k))}</td>)}
            <td className="px-2 pr-3 text-right">{formatMoney(sum("total") - sum("paid"))}</td>
          </tr>
          {!slips.length && <tr><td colSpan={17} className="py-10 text-center text-muted-foreground">
            Chưa có nhân viên nào được thiết lập lương hoặc có chấm công đã duyệt trong kỳ</td></tr>}
          {slips.map((s) => {
            const expanded = open === s.id;
            return (
              <Fragment key={s.id}>
                <tr className={cn("cursor-pointer border-b border-[#eceef1] hover:bg-[#f3f6fa]", expanded && "bg-[#e3f0fc] font-semibold")}
                  onClick={() => setOpen(expanded ? null : s.id)}>
                  <td className="px-2">{expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}</td>
                  <td className="px-2 py-2.5">{s.employeeCode}</td><td className="px-2">{s.employeeName}</td>
                  <td className="px-2 whitespace-nowrap">{salaryTypeLabel(s.salaryType)}</td>
                  <td className="px-2 text-right whitespace-nowrap">{formatNumber(s.workUnits)} {unitLabel(s.salaryType)}</td>
                  {MONEY_COLS.map(([k]) => (
                    <td key={k} className="px-2 text-right">
                      {k === "bonus" && editable ? <BonusInput payrollId={detail.payroll.id} slip={s} /> : formatMoney(Number(s[k] ?? 0))}
                    </td>
                  ))}
                  <td className="px-2 pr-3 text-right">{formatMoney(s.total - s.paid)}</td>
                </tr>
                {expanded && <tr><td colSpan={17} className="p-0"><PayslipDetailPanel slip={s} /></td></tr>}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
