import { ALL_NAMESPACES } from "@/lib/i18n/all-namespaces";
import { I18nPreload } from "@/lib/i18n/i18n-preload";

/**
 * Màn bán hàng nằm ngoài layout quản lý → tự gửi sẵn toàn bộ chuỗi (dùng hộp thoại của nhiều khu vực: khách hàng, QR, giao hàng…)
 * để thu ngân F5 ở en/ja/zh không thấy nháy tiếng Việt.
 */
export default function SaleLayout({ children }: { children: React.ReactNode }) {
  return <I18nPreload namespaces={ALL_NAMESPACES}>{children}</I18nPreload>;
}
