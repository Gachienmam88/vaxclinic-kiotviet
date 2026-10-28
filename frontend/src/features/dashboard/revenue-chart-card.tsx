"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";
import { dashboardNs } from "@/messages/dashboard";
import { commonNs } from "@/messages/common";
import type { DailyRevenue } from "@/features/accounting/tax-calc";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DashboardColumnChart, type Column } from "./dashboard-column-chart";
import { daysBetween, periodRange, PERIOD_KEYS, type DashPeriod } from "./dashboard-date-utils";
import { DashboardPeriodSelect } from "./dashboard-period-select";
import { HOURLY_MAX_PAGES, useHourlyRevenue } from "./dashboard-queries";

type Tab = "day" | "hour" | "weekday";
const TABS = [["day", "revenue.byDay"], ["hour", "revenue.byHour"], ["weekday", "revenue.byWeekday"]] as const satisfies readonly [Tab, string][];
/** Thứ trong tuần theo getDay(): 0 = Chủ nhật; hiển thị từ Thứ 2. */
const WEEKDAYS = [[1, "weekday.mon"], [2, "weekday.tue"], [3, "weekday.wed"], [4, "weekday.thu"], [5, "weekday.fri"], [6, "weekday.sat"], [0, "weekday.sun"]] as const;

const net = (r: DailyRevenue) => Number(r.sales) - Number(r.returns);
const dayOf = (s: string) => new Date(`${s}T00:00:00`);

/** Thẻ "Doanh thu thuần": tổng kỳ + biểu đồ cột theo ngày / giờ / thứ. rows phải phủ từ đầu tháng trước đến hôm nay. */
export function RevenueChartCard({ rows, today, canInvoices }: { rows: DailyRevenue[]; today: Date; canInvoices: boolean }) {
  const t = useT(dashboardNs);
  const tc = useT(commonNs);
  const [tab, setTab] = useState<Tab>("day");
  const [period, setPeriod] = useState<DashPeriod>("today");
  const { from, to } = periodRange(period, today);
  const days = daysBetween(from, to);
  const inRange = rows.filter((r) => days.includes(r.date));
  const total = inRange.reduce((s, r) => s + net(r), 0);
  const hourly = useHourlyRevenue(from, to, tab === "hour" && canInvoices);

  let columns: Column[] = [];
  if (tab === "day") {
    columns = days.map((d) => ({
      label: String(dayOf(d).getDate()), title: dayOf(d).toLocaleDateString("vi-VN"),
      value: inRange.filter((r) => r.date === d).reduce((s, r) => s + net(r), 0),
    }));
  } else if (tab === "weekday") {
    columns = WEEKDAYS.map(([wd, key]) => ({
      label: t(key), title: t(key), value: inRange.filter((r) => dayOf(r.date).getDay() === wd).reduce((s, r) => s + net(r), 0),
    }));
  } else if (hourly.data) {
    columns = hourly.data.map((v, h) => ({ label: `${h}h`, title: `${h}:00 – ${h}:59`, value: v }));
  }

  let note: string | null = null;
  if (tab === "hour") {
    if (!canInvoices) note = t("revenue.needInvoicePermission");
    else if (hourly.isLoading) note = tc("status.loading");
    else if (hourly.isError) note = t("revenue.loadFailed");
    else if (hourly.data === null) note = t("revenue.tooMany", { max: HOURLY_MAX_PAGES * 100 });
  }

  return (
    <section className="rounded-lg bg-background px-5 py-4" aria-labelledby="revenue-title">
      <div className="flex items-center gap-3">
        <h2 id="revenue-title" className="text-[13px] font-semibold">{t("revenue.title")}</h2>
        <span className="rounded-md bg-primary-tint px-2 py-0.5 text-[15px] font-semibold text-primary">{formatMoney(total)}</span>
        <div className="ml-auto"><DashboardPeriodSelect label={t("revenue.periodLabel")} value={period} onChange={setPeriod} /></div>
      </div>
      <div role="tablist" aria-label={t("revenue.chartType")} className="mt-4 mb-6 flex gap-1 border-b border-[#eceef1]">
        {TABS.map(([v, key]) => (
          <button key={v} type="button" role="tab" aria-selected={tab === v} onClick={() => setTab(v)}
            className={cn("-mb-px border-b-2 px-3 pb-2.5 text-[13px]",
              tab === v ? "border-primary text-primary" : "border-transparent text-foreground/70 hover:text-foreground")}>
            {t(key)}
          </button>
        ))}
      </div>
      {note ? <p className="py-20 text-center text-[13px] text-muted-foreground">{note}</p>
        : <DashboardColumnChart columns={columns} />}
      {tab === "hour" && !note && (
        <p className="mt-2 text-[11px] text-muted-foreground">{t("revenue.hourlyNote", { period: t(PERIOD_KEYS[period]).toLowerCase() })}</p>
      )}
    </section>
  );
}
