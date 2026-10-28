import { I18nPreload } from "@/lib/i18n/i18n-preload";

export default function DeliveryLayout({ children }: { children: React.ReactNode }) {
  return <I18nPreload namespaces={["delivery", "sales"]}>{children}</I18nPreload>;
}
