import type { ReactNode } from "react";
import { I18nSeed } from "./i18n-provider";
import { getRequestLocale, loadServerMessages } from "./server";

/**
 * Server component: gửi sẵn message của các namespace cho 1 nhánh route để lần tải trang đầu (F5) ở en/ja/zh
 * hiện đúng ngôn ngữ ngay, không nháy tiếng Việt. Dùng trong layout.tsx (server) của khu vực:
 *   <I18nPreload namespaces={["settings"]}><SettingsShell>{children}</SettingsShell></I18nPreload>
 * Tiếng Việt: không gửi gì (đã có trong bundle).
 */
export async function I18nPreload({ namespaces, children }: { namespaces: readonly string[]; children: ReactNode }) {
  const locale = await getRequestLocale();
  const messages = await loadServerMessages(locale, namespaces);
  if (!Object.keys(messages).length) return <>{children}</>;
  return <I18nSeed locale={locale} messages={messages}>{children}</I18nSeed>;
}
