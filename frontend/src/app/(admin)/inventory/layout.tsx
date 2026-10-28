import { I18nPreload } from "@/lib/i18n/i18n-preload";

/** Kho dùng lại khung danh sách / ô chọn hàng của Mua hàng và Hàng hóa → tải sẵn cả 2 namespace đó. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <I18nPreload namespaces={["inventory", "purchases", "products"]}>{children}</I18nPreload>;
}
