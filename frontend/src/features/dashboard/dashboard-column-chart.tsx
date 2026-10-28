"use client";

import { formatMoney } from "@/lib/format";
import { shortMoney } from "./dashboard-date-utils";

/** Bước chia trục "đẹp" (1, 2, 2.5, 5 × 10^n) sao cho có ~ticks vạch. */
export function niceStep(max: number, ticks = 10) {
  if (max <= 0) return 1;
  const raw = max / ticks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const f = [1, 2, 2.5, 5, 10].find((m) => m * mag >= raw) ?? 10;
  return f * mag;
}

export type Column = { label: string; value: number; title: string };

/**
 * Biểu đồ cột dọc thuần CSS (không thư viện): trục Y bên trái 10 vạch, lưới ngang, cột xanh #0070f4.
 * Giá trị âm (trả hàng > bán) vẽ bằng 0 nhưng vẫn hiện trong tooltip.
 */
export function DashboardColumnChart({ columns, height = 300 }: { columns: Column[]; height?: number }) {
  const max = Math.max(0, ...columns.map((c) => c.value));
  const step = niceStep(max);
  const top = Math.max(step, Math.ceil(max / step) * step);
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => top - i * step);

  return (
    <div className="flex gap-2 text-[11px] text-muted-foreground" role="img"
      aria-label={columns.map((c) => `${c.title}: ${formatMoney(c.value)}`).join("; ")}>
      <div className="flex shrink-0 flex-col justify-between text-right" style={{ height }} aria-hidden>
        {ticks.map((t) => <span key={t} className="-my-1.5 leading-3">{shortMoney(t)}</span>)}
      </div>
      <div className="min-w-0 flex-1" aria-hidden>
        <div className="relative" style={{ height }}>
          {ticks.map((t, i) => (
            <div key={t} className="absolute inset-x-0 border-t border-[#e8eaee]" style={{ top: `${(i / (ticks.length - 1)) * 100}%` }} />
          ))}
          <div className="absolute inset-0 flex items-end justify-around">
            {columns.map((c) => (
              <div key={c.label} className="flex h-full min-w-0 flex-1 items-end justify-center" title={`${c.title}: ${formatMoney(c.value)}`}>
                <div className="w-[60%] max-w-[30px] bg-primary transition-[height] hover:bg-[#005fd0]"
                  style={{ height: `${(Math.max(0, c.value) / top) * 100}%` }} />
              </div>
            ))}
          </div>
        </div>
        <div className="mt-1.5 flex justify-around">
          {columns.map((c) => <span key={c.label} className="min-w-0 flex-1 truncate text-center">{c.label}</span>)}
        </div>
      </div>
    </div>
  );
}
