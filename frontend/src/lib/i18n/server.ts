import "server-only";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, normalizeLocale, type Locale } from "./locales";
import type { MessageTree } from "./translate";

/** Ngôn ngữ của request hiện tại (cookie vx_locale, mặc định tiếng Việt). Chỉ dùng trong server component. */
export async function getRequestLocale(): Promise<Locale> {
  return normalizeLocale((await cookies()).get(LOCALE_COOKIE)?.value);
}

/** Đọc sẵn các namespace cho ngôn ngữ khác tiếng Việt (tiếng Việt đã có trong bundle nên trả rỗng). */
export async function loadServerMessages(locale: Locale, namespaces: readonly string[]): Promise<Record<string, MessageTree>> {
  if (locale === DEFAULT_LOCALE) return {};
  const entries = await Promise.all(namespaces.map(async (ns) => {
    try {
      const mod = (await import(`../../messages/${locale}/${ns}.json`)) as { default: MessageTree };
      return [ns, mod.default] as const;
    } catch {
      return null; // thiếu file → client rơi về tiếng Việt
    }
  }));
  return Object.fromEntries(entries.filter((e) => e !== null));
}
