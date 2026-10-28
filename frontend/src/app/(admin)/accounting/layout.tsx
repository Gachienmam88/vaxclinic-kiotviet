import { I18nPreload } from "@/lib/i18n/i18n-preload";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <I18nPreload namespaces={["accounting"]}>{children}</I18nPreload>;
}
