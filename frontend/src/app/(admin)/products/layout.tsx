import { I18nPreload } from "@/lib/i18n/i18n-preload";

export default function ProductsLayout({ children }: { children: React.ReactNode }) {
  return <I18nPreload namespaces={["products", "purchases"]}>{children}</I18nPreload>;
}
