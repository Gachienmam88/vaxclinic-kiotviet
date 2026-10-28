"use client";

import { useState } from "react";
import { niceStep } from "@/features/dashboard/dashboard-column-chart";
import { shortMoney } from "@/features/dashboard/dashboard-date-utils";
import { formatMoney, formatNumber } from "@/lib/format";

/** Biểu đồ báo cáo thuần CSS/SVG (không thư viện) theo kiểu KiotViet: khung trắng, tiêu đề giữa, cột / thanh xanh #0070f4. */

export type ChartItem = { label: string; value: number };

export function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md bg-background px-3 pt-3 pb-2">
      <h2 className="mb-2 text-center text-[13px] text-[#333]">{title}</h2>
      {children}
    </section>
  );
}

const axis = (items: ChartItem[], ticks = 10) => {
  const max = Math.max(0, ...items.map((i) => i.value));
  const step = niceStep(max || 1, ticks);
  const top = Math.max(step, Math.ceil(max / step) * step);
  return { top, ticks: Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step) };
};
const fmt = (v: number, money: boolean) => (money ? shortMoney(v) : formatNumber(v));

/** Cột dọc + bong bóng giá trị khi rê chuột (Doanh thu thuần theo ngày / tháng). */
export function ColumnChart({ items, height = 290, money = true }: { items: ChartItem[]; height?: number; money?: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const { top, ticks } = axis(items);
  return (
    <div className="flex gap-2 text-[10px] text-[#666]" role="img" aria-label={items.map((i) => `${i.label}: ${formatMoney(i.value)}`).join("; ")}>
      <div className="relative w-9 shrink-0" style={{ height }}>
        {ticks.map((t) => <span key={t} className="absolute right-0 translate-y-1/2" style={{ bottom: `${(t / top) * 100}%` }}>{fmt(t, money)}</span>)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="relative border-b border-l border-[#ccc]" style={{ height }}>
          {ticks.map((t) => <div key={t} className="absolute inset-x-0 border-t border-[#e6e6e6]" style={{ bottom: `${(t / top) * 100}%` }} />)}
          <div className="absolute inset-0 flex items-end">
            {items.map((c, i) => (
              <div key={c.label} className="relative flex h-full flex-1 items-end justify-center" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <div className={hover === i ? "w-[28px] bg-primary-soft" : "w-[28px] bg-primary"} style={{ height: `${(Math.max(0, c.value) / top) * 100}%` }} />
                {hover === i && (
                  <span className="absolute z-10 ml-[86px] rounded bg-primary px-1.5 py-1 text-[11px] whitespace-nowrap text-white shadow"
                    style={{ bottom: `calc(${(Math.max(0, c.value) / top) * 100}% - 22px)` }}>{money ? formatMoney(c.value) : formatNumber(c.value)}</span>)}
              </div>))}
          </div>
        </div>
        <div className="mt-1 flex">{items.map((c) => <span key={c.label} className="flex-1 truncate text-center">{c.label}</span>)}</div>
      </div>
    </div>
  );
}

/** Thanh ngang (Top 10 ...): nhãn bên trái, trục giá trị phía dưới. */
export function BarChart({ items, money = true }: { items: ChartItem[]; money?: boolean }) {
  const { top, ticks } = axis(items, 10);
  if (!items.length) return <EmptyChart />;
  return (
    <div className="text-[10px] text-[#666]">
      <div className="flex">
        <div className="w-[180px] shrink-0">
          {items.map((i) => <div key={i.label} className="flex h-[30px] items-center justify-end pr-1.5 text-right text-[#2d5591]" title={i.label}><span className="line-clamp-2">{i.label}</span></div>)}
        </div>
        <div className="relative min-w-0 flex-1 border-l border-[#ccc]">
          {ticks.map((t) => <div key={t} className="absolute inset-y-0 border-l border-[#e6e6e6]" style={{ left: `${(t / top) * 100}%` }} />)}
          {items.map((i) => (
            <div key={i.label} className="relative flex h-[30px] items-center" title={`${i.label}: ${money ? formatMoney(i.value) : formatNumber(i.value)}`}>
              <div className="h-[14px] bg-primary hover:bg-primary-soft" style={{ width: `${(Math.max(0, i.value) / top) * 100}%` }} />
            </div>))}
        </div>
      </div>
      <div className="relative ml-[180px] h-5">
        {ticks.map((t) => <span key={t} className="absolute top-1 -translate-x-1/2" style={{ left: `${(t / top) * 100}%` }}>{fmt(t, money)}</span>)}
      </div>
    </div>
  );
}

export function EmptyChart() {
  return <div className="flex h-[300px] items-center justify-center border-b border-l border-[#ccc] text-xs text-muted-foreground">Không có dữ liệu</div>;
}

const PIE_COLORS = ["#2f8cf2", "#f5a623", "#7ed321", "#d0021b", "#9013fe", "#50e3c2", "#8b572a", "#4a4a4a"];

/** Biểu đồ tròn + chú thích "nhãn - %" (Doanh thu kênh bán hàng). */
export function PieChart({ items }: { items: ChartItem[] }) {
  const data = items.filter((i) => i.value > 0);
  const total = data.reduce((s, i) => s + i.value, 0);
  if (!total) return <EmptyChart />;
  let angle = -Math.PI / 2;
  const slices = data.map((d, idx) => {
    const a = (d.value / total) * Math.PI * 2, start = angle;
    angle += a;
    const r = 120, large = a > Math.PI ? 1 : 0;
    const p = (t: number) => `${130 + r * Math.cos(t)} ${130 + r * Math.sin(t)}`;
    const path = a >= Math.PI * 2 - 1e-9 ? `M 130 10 A ${r} ${r} 0 1 1 129.99 10 Z` : `M 130 130 L ${p(start)} A ${r} ${r} 0 ${large} 1 ${p(angle)} Z`;
    return { ...d, path, color: PIE_COLORS[idx % PIE_COLORS.length] };
  });
  return (
    <div className="flex flex-col items-center gap-2 text-[11px]">
      <svg viewBox="0 0 260 260" className="h-[260px] w-[260px]" role="img" aria-label="Biểu đồ tròn">
        {slices.map((s) => <path key={s.label} d={s.path} fill={s.color} stroke="#fff" strokeWidth={1}><title>{`${s.label}: ${formatMoney(s.value)}`}</title></path>)}
      </svg>
      {slices.map((s) => (
        <p key={s.label} className="flex items-center gap-2">
          <span className="rounded bg-primary px-1.5 py-0.5 font-semibold text-white">{formatMoney(s.value)}</span>
          <span className="text-[#555]">{s.label} - {((s.value / total) * 100).toFixed(2)} %</span>
        </p>))}
      <div className="flex flex-wrap justify-center gap-3 pb-2 text-[#555]">
        {slices.map((s) => <span key={s.label} className="flex items-center gap-1"><span className="size-2" style={{ background: s.color }} />{s.label}</span>)}
      </div>
    </div>
  );
}
