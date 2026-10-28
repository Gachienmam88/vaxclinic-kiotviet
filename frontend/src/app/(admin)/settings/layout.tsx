import { SettingsShell } from "@/features/settings/settings-shell";
import { I18nPreload } from "@/lib/i18n/i18n-preload";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <I18nPreload namespaces={["settings", "sales"]}>{/* sales: QrPaymentDialog ở trang Tài khoản ngân hàng */}
      <SettingsShell>{children}</SettingsShell>
    </I18nPreload>
  );
}
