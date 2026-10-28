/**
 * Mốc thời gian của bộ lọc báo cáo kiểu KiotViet (Hôm nay, Tuần này, Quý này...). Mọi ngày là ngày địa phương;
 * API nhận Instant [from, to) với to = đầu ngày kế tiếp ngày cuối.
 */
import { addDays, ymd } from "@/features/dashboard/dashboard-date-utils";
import type { ReportsT } from "@/messages/reports";

export type TimePreset =
  | "today" | "yesterday" | "thisWeek" | "lastWeek" | "last7" | "thisMonth" | "lastMonth" | "last30"
  | "thisQuarter" | "lastQuarter" | "thisYear" | "lastYear";

/**
 * Nhóm mốc theo cột như popup chọn thời gian của KiotViet. Nhãn dịch bằng namespace reports:
 * t(`presetGroups.${id}`) và t(`presets.${mốc}`) (dùng ở báo cáo và bộ lọc Hóa đơn features/sales).
 */
export const PRESET_GROUPS: { id: "day" | "month" | "year"; items: TimePreset[] }[] = [
  { id: "day", items: ["today", "yesterday", "thisWeek", "lastWeek", "last7"] },
  { id: "month", items: ["thisMonth", "lastMonth", "last30", "thisQuarter", "lastQuarter"] },
  { id: "year", items: ["thisYear", "lastYear"] },
];

export type DateRange = { from: Date; to: Date };

/** Tuần bắt đầu thứ Hai (như KiotViet). */
const monday = (d: Date) => addDays(d, -((d.getDay() + 6) % 7));

export function presetRange(p: TimePreset, now = new Date()): DateRange {
  const t = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const y = t.getFullYear(), m = t.getMonth(), q = Math.floor(m / 3) * 3;
  switch (p) {
    case "today": return { from: t, to: t };
    case "yesterday": return { from: addDays(t, -1), to: addDays(t, -1) };
    case "thisWeek": return { from: monday(t), to: addDays(monday(t), 6) };
    case "lastWeek": return { from: addDays(monday(t), -7), to: addDays(monday(t), -1) };
    case "last7": return { from: addDays(t, -6), to: t };
    case "thisMonth": return { from: new Date(y, m, 1), to: new Date(y, m + 1, 0) };
    case "lastMonth": return { from: new Date(y, m - 1, 1), to: new Date(y, m, 0) };
    case "last30": return { from: addDays(t, -29), to: t };
    case "thisQuarter": return { from: new Date(y, q, 1), to: new Date(y, q + 3, 0) };
    case "lastQuarter": return { from: new Date(y, q - 3, 1), to: new Date(y, q, 0) };
    case "thisYear": return { from: new Date(y, 0, 1), to: new Date(y, 11, 31) };
    case "lastYear": return { from: new Date(y - 1, 0, 1), to: new Date(y - 1, 11, 31) };
  }
}

/** yyyy-MM-dd → Date địa phương (00:00). */
export const parseYmd = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

/** 28/10/2026 */
export const dmy = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

/** "Từ ngày 26/10/2026 đến ngày 28/10/2026" hoặc "Ngày 28/10/2026" (câu theo ngôn ngữ, ngày luôn dd/MM/yyyy). */
export const rangeText = (t: ReportsT, r: DateRange) =>
  ymd(r.from) === ymd(r.to) ? t("range.single", { date: dmy(r.from) }) : t("range.between", { from: dmy(r.from), to: dmy(r.to) });

/** Giá trị bộ lọc Thời gian: 1 mốc hoặc khoảng tùy chỉnh (yyyy-MM-dd). */
export type TimeValue = { mode: "preset"; preset: TimePreset } | { mode: "custom"; from: string; to: string };

export function timeRange(v: TimeValue): DateRange {
  if (v.mode === "preset") return presetRange(v.preset);
  const from = parseYmd(v.from), to = parseYmd(v.to);
  return to < from ? { from: to, to: from } : { from, to };
}

/** Nhãn khoảng thời gian chèn trong câu (tiêu đề biểu đồ): "tuần này" / "this week"... */
export const timeLabel = (t: ReportsT, v: TimeValue) =>
  (v.mode === "preset" ? t(`presets.${v.preset}`) : rangeText(t, timeRange(v))).toLowerCase();

/** Ngày dd của từng ngày trong khoảng (cột biểu đồ theo ngày), hoặc tháng MM/yyyy nếu khoảng > 62 ngày. */
export function chartBuckets(r: DateRange): { key: string; label: string }[] {
  const days = Math.round((r.to.getTime() - r.from.getTime()) / 86_400_000) + 1;
  const out: { key: string; label: string }[] = [];
  if (days > 62) {
    for (let d = new Date(r.from.getFullYear(), r.from.getMonth(), 1); d <= r.to; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
      out.push({ key: ymd(d).slice(0, 7), label: `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}` });
    }
    return out;
  }
  for (let d = r.from; d <= r.to; d = addDays(d, 1)) out.push({ key: ymd(d), label: String(d.getDate()) });
  return out;
}
