import type { Locale } from "@/lib/i18n/locales";

/** Ngôi sao 5 cánh tâm (0,0) bán kính 1 — scale/translate theo chỗ dùng. */
const STAR = "M0,-1 L0.2245,-0.309 L0.9511,-0.309 L0.3633,0.118 L0.5878,0.809 L0,0.382 L-0.5878,0.809 L-0.3633,0.118 L-0.9511,-0.309 L-0.2245,-0.309Z";

/** Cờ nhỏ (SVG nội tuyến, 18×12) cạnh tên ngôn ngữ trong menu "Chọn ngôn ngữ" — giống KiotViet, không dùng ảnh ngoài. */
export function LocaleFlagIcon({ locale }: { locale: Locale }) {
  return (
    <svg viewBox="0 0 18 12" className="h-3 w-[18px] shrink-0 overflow-hidden rounded-[2px] ring-1 ring-black/10" aria-hidden="true">
      {locale === "vi" && (
        <>
          <rect width="18" height="12" fill="#da251d" />
          <path d={STAR} fill="#ffff00" transform="translate(9 6.3) scale(3.4)" />
        </>
      )}
      {locale === "en" && (
        <>
          <rect width="18" height="12" fill="#ffffff" />
          {[0, 2, 4, 6, 8, 10].map((i) => <rect key={i} y={(i * 12) / 13 + 0} width="18" height={12 / 13} fill="#b22234" transform={`translate(0 ${(i * 12) / 13})`} />)}
          <rect width="7.6" height={(12 * 7) / 13} fill="#3c3b6e" />
        </>
      )}
      {locale === "ja" && (
        <>
          <rect width="18" height="12" fill="#ffffff" />
          <circle cx="9" cy="6" r="3.6" fill="#bc002d" />
        </>
      )}
      {locale === "zh" && (
        <>
          <rect width="18" height="12" fill="#de2910" />
          <path d={STAR} fill="#ffde00" transform="translate(3 3) scale(1.8)" />
          {[[6, 1.2], [7.2, 2.4], [7.2, 4], [6, 5.2]].map(([x, y]) => (
            <path key={`${x}-${y}`} d={STAR} fill="#ffde00" transform={`translate(${x} ${y}) scale(0.6)`} />
          ))}
        </>
      )}
    </svg>
  );
}
