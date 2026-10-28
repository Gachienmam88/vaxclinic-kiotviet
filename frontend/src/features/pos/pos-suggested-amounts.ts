/** Mệnh giá làm tròn lên để gợi ý "Khách thanh toán" (VD 978,000 → 978,000 · 980,000 · 1,000,000). */
const STEPS = [10_000, 50_000, 100_000, 200_000, 500_000, 1_000_000];

/** Các ô gợi ý tiền khách đưa: đúng số cần trả + các mức làm tròn lên, không trùng, tăng dần, tối đa 6 ô. */
export function suggestedAmounts(due: number, max = 6): number[] {
  const amount = Math.round(due);
  if (amount <= 0) return [];
  const out = new Set<number>([amount]);
  for (const step of STEPS) out.add(Math.ceil(amount / step) * step);
  return [...out].sort((a, b) => a - b).slice(0, max);
}
