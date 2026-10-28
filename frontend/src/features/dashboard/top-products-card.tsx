"use client";

import { useState } from "react";
import type { DailyRevenue } from "@/features/accounting/tax-calc";
import { useT } from "@/lib/i18n";
import { formatMoney } from "@/lib/format";
import { dashboardNs } from "@/messages/dashboard";
import { niceStep } from "./dashboard-column-chart";
import { daysBetween, periodRange, shortMoney, type DashPeriod } from "./dashboard-date-utils";
import { DashboardPeriodSelect } from "./dashboard-period-select";
import { useProductNames } from "./dashboard-queries";

/** "Top 10 hàng bán chạy" theo doanh thu thuần — gom /accounting/revenue/daily theo mặt hàng, thanh ngang thuần CSS. */
export function TopProductsCard({ rows, today }: { rows: DailyRevenue[]; today: Date }) {
  const t = useT(dashboardNs);
  const [period, setPeriod] = useState<DashPeriod>("thisMonth");
  const { from, to } = periodRange(period, today);
  const days = new Set(daysBetween(from, to));
  const byProduct = new Map<string, number>();
  rows.filter((r) => days.has(r.date)).forEach((r) =>
    byProduct.set(r.productId, (byProduct.get(r.productId) ?? 0) + Number(r.sales) - Number(r.returns)));
  const top = [...byProduct].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const names = useProductNames(top.map(([id]) => id));
  const max = top[0]?.[1] ?? 0;
  const step = niceStep(max, 5);
  const axis = Math.max(step, Math.ceil(max / step) * step);
  const ticks = Array.from({ length: Math.round(axis / step) + 1 }, (_, i) => i * step);

  return (
    <section className="rounded-lg bg-background px-5 py-4" aria-labelledby="top-products-title">
      <div className="mb-3 flex items-center gap-2">
        <h2 id="top-products-title" className="flex-1 text-[13px] font-semibold">{t("top.title")}</h2>
        <span className="text-xs text-muted-foreground">{t("top.byNet")}</span>
        <DashboardPeriodSelect label={t("top.periodLabel")} value={period} onChange={setPeriod} />
      </div>
      {!top.length ? <p className="py-16 text-center text-[13px] text-muted-foreground">{t("top.empty")}</p> : (
        <>
          <ol className="space-y-2.5">
            {top.map(([id, v]) => (
              <li key={id} className="text-[11px]">
                <p className="truncate text-foreground/80">{names.get(id) ?? "…"}</p>
                <div className="relative mt-0.5 mr-12 h-[18px]">
                  <div className="h-full bg-primary" style={{ width: `${(v / axis) * 100}%` }} />
                  <span className="absolute top-0.5 whitespace-nowrap text-muted-foreground" style={{ left: `calc(${(v / axis) * 100}% + 6px)` }}
                    title={formatMoney(v)}>{shortMoney(v, t)}</span>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-2 mr-12 flex justify-between border-t border-[#e8eaee] pt-1 text-[11px] text-muted-foreground" aria-hidden>
            {ticks.map((v) => <span key={v}>{shortMoney(v, t)}</span>)}
          </div>
        </>
      )}
    </section>
  );
}
