import { SettingsShell } from "@/features/settings/settings-shell";
import { I18nPreload } from "@/lib/i18n/i18n-preload";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <I18nPreload namespaces={["settings", "sales", "accounting", "print"]}>{/* sales: QR ở Tài khoản ngân hàng; accounting: trang Thuế; print: Mẫu in */}
      <SettingsShell>{children}</SettingsShell>
    </I18nPreload>
  );
}
