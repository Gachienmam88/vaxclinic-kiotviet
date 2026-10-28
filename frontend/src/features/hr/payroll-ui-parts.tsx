"use client";

import { DocCodeLink } from "@/components/ui/doc-code-link";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { hrNs, type HrT } from "@/messages/hr";
import { PAYROLL_STATUS, type PayrollStatus, type Payslip } from "./hr-types";

/** Phần dùng chung màn Bảng lương: nhãn trạng thái, badge, chi tiết diễn giải phiếu lương. */

export const statusLabel = (t: HrT, s: PayrollStatus) => { const k = PAYROLL_STATUS.find((x) => x[0] === s)?.[1]; return k ? t(k) : s; };

const TONE: Record<PayrollStatus, string> = {
  DRAFT: "bg-[#eff0f3] text-foreground", TEMP: "bg-[#fff4e5] text-[#e67e22]",
  LOCKED: "bg-[#e3f8ec] text-[#0f9d58]", CANCELLED: "bg-[#fce4e4] text-[#d93025]",
};

export function PayrollStatusBadge({ status }: { status: PayrollStatus }) {
  const t = useT(hrNs);
  return <span className={cn("inline-flex h-[22px] items-center rounded px-1.5 text-xs font-medium", TONE[status])}>{statusLabel(t, status)}</span>;
}

/** Đơn vị của cột "Số công": ca / giờ / ngày công. */
export const unitLabel = (t: HrT, type: Payslip["salaryType"]) =>
  t(type === "SHIFT" ? "payslip.unitShift" : type === "HOUR" ? "payslip.unitHour" : "payslip.unitDay");

const KIND = { DAY: "payslip.kindDay", MONTH: "payslip.kindMonth", LATE: "payslip.kindLate", EARLY: "payslip.kindEarly" } as const;
const kindLabel = (t: HrT, k: string) => (k in KIND ? t(KIND[k as keyof typeof KIND]) : k);

/** Diễn giải phiếu lương (mở dưới dòng nhân viên). */
export function PayslipDetailPanel({ slip }: { slip: Payslip }) {
  const t = useT(hrNs);
  const d = slip.details;
  if (!d) return <p className="p-3 text-muted-foreground">{t("payslip.noDetails")}</p>;
  const stat = (label: string, v: string | number) => (
    <div><p className="text-muted-foreground">{label}</p><p className="font-semibold">{v}</p></div>
  );
  return (
    <div className="space-y-3 border border-primary bg-white p-3 text-[12px]">
      <div className="grid grid-cols-6 gap-3">
        {stat(t("payslip.standardDays"), d.standardDays)}{stat(t("payslip.workedDays"), d.workedDays)}{stat(t("payslip.approvedShifts"), d.shifts)}
        {stat(t("payslip.lateCount"), d.lateCount)}{stat(t("payslip.earlyCount"), d.earlyCount)}
        {stat(t("payslip.overtime"), t("payslip.hoursMinutes", { hours: Math.floor(d.overtimeMinutes / 60), minutes: d.overtimeMinutes % 60 }))}
      </div>
      <div className="grid grid-cols-3 gap-4">
        <ItemList title={t("payslip.allowances")} rows={d.allowances.map((a) => [a.name, kindLabel(t, a.kind), a.amount])} />
        <ItemList title={t("payslip.deductions")} rows={d.deductions.map((a) => [a.name, kindLabel(t, a.kind), a.amount])} />
        <ItemList title={t("payslip.commission")} rows={d.commissions.map((c) => [<><DocCodeLink code={c.productCode} /> - {c.productName}</>,
          t("payslip.commissionSub", { qty: c.quantity, revenue: formatMoney(c.revenue) }), c.commission])} />
      </div>
    </div>
  );
}

function ItemList({ title, rows }: { title: string; rows: [React.ReactNode, string, number][] }) {
  const tc = useT(commonNs);
  return (
    <div>
      <p className="mb-1 font-semibold">{title}</p>
      {!rows.length && <p className="text-muted-foreground">{tc("status.none")}</p>}
      {rows.map(([name, sub, v], i) => (
        <div key={i} className="flex justify-between gap-2 border-b border-[#eceef1] py-1">
          <span>{name} <span className="text-muted-foreground">({sub})</span></span><span>{formatMoney(v)}</span>
        </div>
      ))}
    </div>
  );
}
