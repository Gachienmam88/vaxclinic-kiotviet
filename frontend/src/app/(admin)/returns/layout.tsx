import { I18nPreload } from "@/lib/i18n/i18n-preload";

/** Trả hàng — gửi sẵn bản dịch để F5 ở en/ja/zh không nháy tiếng Việt. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <I18nPreload namespaces={["sales"]}>{children}</I18nPreload>;
}
