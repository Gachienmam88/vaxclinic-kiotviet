/** Nhãn giao diện (theo ngôn ngữ) cho kỳ kê khai và nhóm doanh thu. Period.label của tax-calc giữ tiếng Việt cho sổ / CSV. */
import type { TFunction } from "@/lib/i18n";
import type { accountingNs } from "@/messages/accounting";
import type { Period } from "./tax-calc";

type T = TFunction<typeof accountingNs.vi>;

/** Nhóm doanh thu 1–4 (ngưỡng 1 tỷ / 3 tỷ / 50 tỷ). */
export const REVENUE_GROUPS = [1, 2, 3, 4] as const;
const GROUP_KEYS = { 1: "groups.g1", 2: "groups.g2", 3: "groups.g3", 4: "groups.g4" } as const;

export const groupLabel = (t: T, group: number) => t(GROUP_KEYS[group as keyof typeof GROUP_KEYS] ?? "groups.g1");

/** "Tháng 3" / "Quý 2" theo ngôn ngữ, suy từ ngày đầu–cuối kỳ (kỳ quý trải 3 tháng). */
export function periodLabel(t: T, p: Period) {
  const month = Number(p.from.slice(5, 7));
  return p.from.slice(5, 7) === p.to.slice(5, 7)
    ? t("period.month", { n: month })
    : t("period.quarter", { n: Math.ceil(month / 3) });
}
