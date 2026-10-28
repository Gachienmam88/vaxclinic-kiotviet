import { I18nPreload } from "@/lib/i18n/i18n-preload";

/**
 * Màn bán hàng nằm ngoài layout quản lý → tự gửi sẵn chuỗi của mình (+ hộp thoại khách hàng / QR / giao hàng dùng chung từ features/sales, customers, delivery)
 * để thu ngân F5 ở en/ja/zh không thấy nháy tiếng Việt.
 */
export default function SaleLayout({ children }: { children: React.ReactNode }) {
  return <I18nPreload namespaces={["sale", "sales", "customers", "delivery"]}>{children}</I18nPreload>;
}
