"use client";

import { useState } from "react";
import type { DailyRevenue } from "@/features/accounting/tax-calc";
import { formatMoney } from "@/lib/format";
import { niceStep } from "./dashboard-column-chart";
import { daysBetween, periodRange, shortMoney, type DashPeriod } from "./dashboard-date-utils";
import { DashboardPeriodSelect } from "./dashboard-period-select";
import { useProductNames } from "./dashboard-queries";

/** "Top 10 hàng bán chạy" theo doanh thu thuần — gom /accounting/revenue/daily theo mặt hàng, thanh ngang thuần CSS. */
export function TopProductsCard({ rows, today }: { rows: DailyRevenue[]; today: Date }) {
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
        <h2 id="top-products-title" className="flex-1 text-[13px] font-semibold">Top 10 hàng bán chạy</h2>
        <span className="text-xs text-muted-foreground">Theo doanh thu thuần</span>
        <DashboardPeriodSelect label="Kỳ hàng bán chạy" value={period} onChange={setPeriod} />
      </div>
      {!top.length ? <p className="py-16 text-center text-[13px] text-muted-foreground">Chưa có dữ liệu bán hàng</p> : (
        <>
          <ol className="space-y-2.5">
            {top.map(([id, v]) => (
              <li key={id} className="text-[11px]">
                <p className="truncate text-foreground/80">{names.get(id) ?? "…"}</p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <div className="h-[18px] bg-primary" style={{ width: `calc(${(v / axis) * 100}% - 40px)` }} />
                  <span className="whitespace-nowrap text-muted-foreground" title={formatMoney(v)}>{shortMoney(v)}</span>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-2 flex justify-between border-t border-[#e8eaee] pt-1 text-[11px] text-muted-foreground" aria-hidden>
            {ticks.map((t) => <span key={t}>{shortMoney(t)}</span>)}
          </div>
        </>
      )}
    </section>
  );
}
