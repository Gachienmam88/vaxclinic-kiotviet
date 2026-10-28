"use client";

import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PAYROLL_STATUS, type PayrollStatus, type Payslip } from "./hr-types";

/** Phần dùng chung màn Bảng lương: nhãn trạng thái, badge, chi tiết diễn giải phiếu lương. */

export const statusLabel = (s: PayrollStatus) => PAYROLL_STATUS.find((x) => x[0] === s)?.[1] ?? s;

const TONE: Record<PayrollStatus, string> = {
  DRAFT: "bg-[#eff0f3] text-foreground", TEMP: "bg-[#fff4e5] text-[#e67e22]",
  LOCKED: "bg-[#e3f8ec] text-[#0f9d58]", CANCELLED: "bg-[#fce4e4] text-[#d93025]",
};

export function PayrollStatusBadge({ status }: { status: PayrollStatus }) {
  return <span className={cn("inline-flex h-[22px] items-center rounded px-1.5 text-xs font-medium", TONE[status])}>{statusLabel(status)}</span>;
}

/** Đơn vị của cột "Số công": ca / giờ / ngày công. */
export const unitLabel = (t: Payslip["salaryType"]) => (t === "SHIFT" ? "ca" : t === "HOUR" ? "giờ" : "công");

const KIND: Record<string, string> = { DAY: "theo ngày làm", MONTH: "cố định tháng", LATE: "mỗi lần đi muộn", EARLY: "mỗi lần về sớm" };

/** Diễn giải phiếu lương (mở dưới dòng nhân viên). */
export function PayslipDetailPanel({ slip }: { slip: Payslip }) {
  const d = slip.details;
  if (!d) return <p className="p-3 text-muted-foreground">Chưa có diễn giải</p>;
  const stat = (label: string, v: string | number) => (
    <div><p className="text-muted-foreground">{label}</p><p className="font-semibold">{v}</p></div>
  );
  return (
    <div className="space-y-3 border border-primary bg-white p-3 text-[12px]">
      <div className="grid grid-cols-6 gap-3">
        {stat("Ngày công chuẩn", d.standardDays)}{stat("Ngày đi làm", d.workedDays)}{stat("Số ca đã duyệt", d.shifts)}
        {stat("Số lần đi muộn", d.lateCount)}{stat("Số lần về sớm", d.earlyCount)}
        {stat("Làm thêm", `${Math.floor(d.overtimeMinutes / 60)} giờ ${d.overtimeMinutes % 60} phút`)}
      </div>
      <div className="grid grid-cols-3 gap-4">
        <ItemList title="Phụ cấp" rows={d.allowances.map((a) => [a.name, KIND[a.kind] ?? a.kind, a.amount])} />
        <ItemList title="Giảm trừ" rows={d.deductions.map((a) => [a.name, KIND[a.kind] ?? a.kind, a.amount])} />
        <ItemList title="Hoa hồng" rows={d.commissions.map((c) => [`${c.productCode} - ${c.productName}`,
          `SL ${c.quantity} · DT ${formatMoney(c.revenue)}`, c.commission])} />
      </div>
    </div>
  );
}

function ItemList({ title, rows }: { title: string; rows: [string, string, number][] }) {
  return (
    <div>
      <p className="mb-1 font-semibold">{title}</p>
      {!rows.length && <p className="text-muted-foreground">Không có</p>}
      {rows.map(([name, sub, v], i) => (
        <div key={i} className="flex justify-between gap-2 border-b border-[#eceef1] py-1">
          <span>{name} <span className="text-muted-foreground">({sub})</span></span><span>{formatMoney(v)}</span>
        </div>
      ))}
    </div>
  );
}
