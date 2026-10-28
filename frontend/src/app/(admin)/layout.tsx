import { AppHeader } from "@/components/layout/app-header";
import { CONTAINER } from "@/lib/layout";
import { ALL_NAMESPACES } from "@/lib/i18n/all-namespaces";
import { I18nPreload } from "@/lib/i18n/i18n-preload";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <I18nPreload namespaces={ALL_NAMESPACES}>
      <div data-kv-scale className="min-h-screen bg-muted">
        <AppHeader />
        <main className={`${CONTAINER} py-4`}>{children}</main>
      </div>
    </I18nPreload>
  );
}
