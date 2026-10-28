/**
 * Danh sách ngôn ngữ giao diện. Tiếng Việt là ngôn ngữ nguồn + mặc định; zh/ja hiện dưới nhóm "Bản thử nghiệm"
 * (giống KiotViet). Chỉ chữ trên giao diện đổi theo ngôn ngữ — tiền/ngày vẫn định dạng Việt Nam (VND, dd/MM/yyyy).
 * File thuần (không React, không "use client") để dùng được cả ở server component, middleware và test node.
 */

export const LOCALES = ["vi", "en", "ja", "zh"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "vi";

/** Cookie để server render đúng ngôn ngữ ngay lần tải đầu; localStorage giữ lựa chọn theo thiết bị. */
export const LOCALE_COOKIE = "vx_locale";
export const LOCALE_STORAGE_KEY = "vx_locale";

type LocaleInfo = {
  /** Tên hiển thị bằng chính ngôn ngữ đó (không dịch). */
  nativeName: string;
  /** Giá trị <html lang> + Intl.PluralRules. */
  htmlLang: string;
  /** Hiện dưới nhóm "Bản thử nghiệm" trong menu chọn ngôn ngữ. */
  beta: boolean;
};

export const LOCALE_INFO: Record<Locale, LocaleInfo> = {
  vi: { nativeName: "Tiếng Việt", htmlLang: "vi", beta: false },
  en: { nativeName: "English", htmlLang: "en", beta: false },
  ja: { nativeName: "日本語", htmlLang: "ja", beta: true },
  zh: { nativeName: "中文 (简体)", htmlLang: "zh-CN", beta: true },
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Cookie/localStorage có thể bị sửa tay → giá trị lạ quay về tiếng Việt. */
export function normalizeLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}
