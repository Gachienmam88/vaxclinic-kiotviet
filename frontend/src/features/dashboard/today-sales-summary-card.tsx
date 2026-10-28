"use client";

import { ArrowDown, ArrowUp, CircleDollarSign, Undo2 } from "lucide-react";
import type { DailyRevenue } from "@/features/accounting/tax-calc";
import { useT } from "@/lib/i18n";
import { formatMoney } from "@/lib/format";
import { dashboardNs } from "@/messages/dashboard";
import { cn } from "@/lib/utils";
import { sameDayLastMonth, ymd } from "./dashboard-date-utils";

const sumOn = (rows: DailyRevenue[], day: string, f: (r: DailyRevenue) => number) =>
  rows.filter((r) => r.date === day).reduce((s, r) => s + f(r), 0);
const net = (r: DailyRevenue) => Number(r.sales) - Number(r.returns);

/** % thay đổi; null khi kỳ so sánh = 0 (không chia được). */
const pct = (cur: number, base: number) => (base === 0 ? null : ((cur - base) / Math.abs(base)) * 100);

function Kpi({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="flex min-w-0 flex-1 gap-2.5 px-4 first:pl-0 sm:border-l sm:border-[#e3e6ea] sm:first:border-l-0">
      <div className="pt-0.5">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-foreground/80">{label}</p>
        <p className="mt-1 text-lg leading-6 font-bold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

function Change({ value, sub }: { value: number | null; sub: string }) {
  const t = useT(dashboardNs);
  const up = (value ?? 0) >= 0;
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <Kpi label={t("today.netRevenue")} sub={sub}
      icon={<Icon className={cn("size-[18px]", up ? "text-[#16a34a]" : "text-[#e5372b]")} strokeWidth={2.2} aria-hidden />}
      value={value == null ? "—" : `${value.toFixed(2)}%`} />
  );
}

/** "Kết quả bán hàng hôm nay": doanh thu, trả hàng, % doanh thu thuần so với hôm qua và cùng kỳ tháng trước. */
export function TodaySalesSummaryCard({ rows, invoiceCount, today }: { rows: DailyRevenue[]; invoiceCount?: number; today: Date }) {
  const t = useT(dashboardNs);
  const d0 = ymd(today);
  const yesterday = ymd(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1));
  const lastMonth = ymd(sameDayLastMonth(today));
  const sales = sumOn(rows, d0, (r) => Number(r.sales));
  const returns = sumOn(rows, d0, (r) => Number(r.returns));
  const netToday = sales - returns;

  return (
    <section className="rounded-lg bg-background px-5 py-4" aria-labelledby="today-title">
      <h2 id="today-title" className="mb-4 text-[15px] font-semibold">{t("today.title")}</h2>
      <div className="grid grid-cols-2 gap-y-4 sm:flex">
        <Kpi label={t("today.revenue")} value={formatMoney(sales)} sub={invoiceCount == null ? undefined : t("today.invoiceCount", { count: invoiceCount })}
          icon={<CircleDollarSign className="size-[18px] fill-primary text-white" aria-hidden />} />
        <Kpi label={t("today.returns")} value={formatMoney(returns)}
          icon={<span className="flex size-[18px] items-center justify-center rounded bg-[#ff8a00]"><Undo2 className="size-3 text-white" strokeWidth={3} aria-hidden /></span>} />
        <Change value={pct(netToday, sumOn(rows, yesterday, net))} sub={t("today.vsYesterday")} />
        <Change value={pct(netToday, sumOn(rows, lastMonth, net))} sub={t("today.vsLastMonth")} />
      </div>
    </section>
  );
}
