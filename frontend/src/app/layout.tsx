import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import { ACCENT_BOOT_SCRIPT } from "@/lib/accent-theme";
import { LOCALE_INFO } from "@/lib/i18n/locales";
import { getRequestLocale, loadServerMessages } from "@/lib/i18n/server";
import "./globals.css";

// Inter ships a Vietnamese subset so diacritics render with the same font.
const inter = Inter({ variable: "--font-sans", subsets: ["latin", "vietnamese"] });

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME ?? "VaxClinic",
  description: "Quản lý kinh doanh vắc xin và dịch vụ tiêm chủng",
};

/** Namespace của khung app (header, menu, thông báo, đăng nhập, lỗi API) — gửi sẵn cho en/ja/zh để F5 không nháy tiếng Việt. */
const SHELL_NAMESPACES = ["common", "nav", "notifications", "auth", "errors"];

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getRequestLocale();
  const seed = await loadServerMessages(locale, SHELL_NAMESPACES);
  return (
    // suppressHydrationWarning: script trong <head> gắn màu chủ đề (style --chrome) lên <html> trước khi React hydrate
    <html lang={LOCALE_INFO[locale].htmlLang} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: ACCENT_BOOT_SCRIPT }} />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers locale={locale} seed={seed}>{children}</Providers>
      </body>
    </html>
  );
}
