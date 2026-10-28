import { I18nPreload } from "@/lib/i18n/i18n-preload";

/** Hóa đơn — gửi sẵn bản dịch (purchases: nhãn trạng thái HĐĐT; reports: mốc thời gian lọc) để F5 ở en/ja/zh không nháy tiếng Việt. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <I18nPreload namespaces={["sales", "delivery", "purchases", "reports"]}>{children}</I18nPreload>;
}
