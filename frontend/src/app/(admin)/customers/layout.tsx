import { I18nPreload } from "@/lib/i18n/i18n-preload";

/** Gửi sẵn chuỗi khu Khách hàng (+ nhãn dùng chung của bán hàng) để F5 ở en/ja/zh không nháy tiếng Việt. */
export default function CustomersLayout({ children }: { children: React.ReactNode }) {
  return <I18nPreload namespaces={["customers", "sales"]}>{children}</I18nPreload>;
}
