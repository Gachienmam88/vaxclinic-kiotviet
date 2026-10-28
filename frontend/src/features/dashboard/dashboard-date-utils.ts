/** Tiện ích ngày cho Tổng quan — mọi ngày là ngày địa phương dạng yyyy-MM-dd (khớp /accounting/revenue/daily). */
import type { TFunction } from "@/lib/i18n";
import type { dashboardNs } from "@/messages/dashboard";

type DashT = TFunction<typeof dashboardNs.vi>;

export type DashPeriod = "today" | "yesterday" | "last7" | "thisMonth" | "lastMonth";

/** Khóa nhãn kỳ (namespace dashboard) — dịch lúc render: t(PERIOD_KEYS[p]). */
export const PERIOD_KEYS = {
  today: "period.today", yesterday: "period.yesterday", last7: "period.last7", thisMonth: "period.thisMonth", lastMonth: "period.lastMonth",
} as const satisfies Record<DashPeriod, string>;

export const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** Cùng ngày của tháng trước (31/3 → 28 hoặc 29/2). */
export function sameDayLastMonth(d: Date) {
  const last = new Date(d.getFullYear(), d.getMonth(), 0).getDate();
  return new Date(d.getFullYear(), d.getMonth() - 1, Math.min(d.getDate(), last));
}

/** Khoảng [from, to] (gồm cả 2 đầu) của 1 kỳ, tính theo hôm nay. */
export function periodRange(p: DashPeriod, today = new Date()): { from: Date; to: Date } {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  switch (p) {
    case "today": return { from: t, to: t };
    case "yesterday": return { from: addDays(t, -1), to: addDays(t, -1) };
    case "last7": return { from: addDays(t, -6), to: t };
    case "thisMonth": return { from: new Date(t.getFullYear(), t.getMonth(), 1), to: t };
    case "lastMonth": return { from: new Date(t.getFullYear(), t.getMonth() - 1, 1), to: new Date(t.getFullYear(), t.getMonth(), 0) };
  }
}

/** Danh sách ngày yyyy-MM-dd từ from đến to. */
export function daysBetween(from: Date, to: Date) {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(ymd(d));
  return out;
}

/** Thời điểm bắt đầu ngày → ISO, dùng cho API nhận Instant (/invoices?from=&to=, to là đầu ngày kế tiếp). */
export const instantRange = (from: Date, to: Date) => ({ from: from.toISOString(), to: addDays(to, 1).toISOString() });

/** "5 phút trước", "2 giờ trước", "3 ngày trước" (theo ngôn ngữ của t). */
export function timeAgo(iso: string, t: DashT, now = Date.now()) {
  const min = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
  if (min < 1) return t("timeAgo.justNow");
  if (min < 60) return t("timeAgo.minutes", { count: min });
  const h = Math.floor(min / 60);
  if (h < 24) return t("timeAgo.hours", { count: h });
  return t("timeAgo.days", { count: Math.floor(h / 24) });
}

/**
 * Rút gọn tiền cho trục biểu đồ: 650000 → "650k", 31900000 → "31.9 tr" (en "31.9M").
 * Không truyền t → đơn vị tiếng Việt (giữ tương thích cho nơi gọi chưa dịch).
 */
export function shortMoney(v: number, t?: DashT) {
  const a = Math.abs(v);
  const fmt = (key: "short.billion" | "short.million" | "short.thousand", n: number, vi: string) => (t ? t(key, { n }) : vi);
  if (a >= 1e9) { const n = +(v / 1e9).toFixed(1); return fmt("short.billion", n, `${n} tỷ`); }
  if (a >= 1e6) { const n = +(v / 1e6).toFixed(1); return fmt("short.million", n, `${n} tr`); }
  if (a >= 1e3) { const n = Math.round(v / 1e3); return fmt("short.thousand", n, `${n}k`); }
  return String(Math.round(v));
}
