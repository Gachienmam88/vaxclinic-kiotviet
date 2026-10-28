import { I18nPreload } from "@/lib/i18n/i18n-preload";

export default function OrdersLayout({ children }: { children: React.ReactNode }) {
  return <I18nPreload namespaces={["orders", "sales"]}>{children}</I18nPreload>;
}
