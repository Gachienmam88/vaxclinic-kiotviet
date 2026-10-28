import { I18nPreload } from "@/lib/i18n/i18n-preload";

/** Gửi sẵn chuỗi khu Sổ quỹ (+ nhãn quỹ / phương thức của bán hàng) để F5 ở en/ja/zh không nháy tiếng Việt. */
export default function CashbookLayout({ children }: { children: React.ReactNode }) {
  return <I18nPreload namespaces={["cashbook", "sales"]}>{children}</I18nPreload>;
}
