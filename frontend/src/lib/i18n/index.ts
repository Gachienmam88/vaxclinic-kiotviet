/** Lối vào i18n phía client. Server component dùng "@/lib/i18n/server" và "@/lib/i18n/i18n-preload". */
export { LOCALES, LOCALE_INFO, DEFAULT_LOCALE, type Locale } from "./locales";
export { createNamespace, type Namespace } from "./namespace";
export { I18nProvider, useLocale, useSetLocale } from "./i18n-provider";
export { useT, type TFunction } from "./use-t";
export type { MessageKey, TranslateVars } from "./translate";
