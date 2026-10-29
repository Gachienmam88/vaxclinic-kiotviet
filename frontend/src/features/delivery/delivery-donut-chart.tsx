"use client";

/**
 * Biểu đồ vành khuyên SVG (tỉ lệ theo trạng thái): mỗi phần 1 màu, tổng ở giữa. Không có dữ liệu → vòng xám.
 * Vẽ bằng stroke-dasharray trên đường tròn, không dùng thư viện biểu đồ.
 */
export function DonutChart({ parts, total, label, format }: {
  parts: { key: string; value: number; color: string; label: string }[]; total: number; label: string; format: (n: number) => string;
}) {
  const r = 70;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg viewBox="0 0 200 200" className="mx-auto size-52" role="img" aria-label={`${label}: ${format(total)}`}>
      <circle cx="100" cy="100" r={r} fill="none" stroke="#eef0f3" strokeWidth="26" />
      {total > 0 && parts.filter((p) => p.value > 0).map((p) => {
        const len = (p.value / total) * c;
        const el = (
          <circle key={p.key} cx="100" cy="100" r={r} fill="none" stroke={p.color} strokeWidth="26"
            strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} transform="rotate(-90 100 100)">
            <title>{`${p.label}: ${format(p.value)}`}</title></circle>);
        offset += len;
        return el;
      })}
      <text x="100" y="94" textAnchor="middle" className="fill-muted-foreground text-[13px]">{label}</text>
      <text x="100" y="116" textAnchor="middle" className="fill-foreground text-[15px] font-semibold">{format(total)}</text>
    </svg>
  );
}
