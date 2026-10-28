import { StoreProfileShell } from "@/features/store-profile/store-profile-shell";
import { I18nPreload } from "@/lib/i18n/i18n-preload";

export default function StoreProfileLayout({ children }: { children: React.ReactNode }) {
  return <I18nPreload namespaces={["store-profile"]}><StoreProfileShell>{children}</StoreProfileShell></I18nPreload>;
}
