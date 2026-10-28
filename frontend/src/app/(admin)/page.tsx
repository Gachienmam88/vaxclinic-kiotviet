import { DashboardPageContent } from "@/features/dashboard/dashboard-page-content";
import { I18nPreload } from "@/lib/i18n/i18n-preload";

/** Tổng quan (server): gửi sẵn bản dịch "dashboard" rồi vẽ nội dung client. */
export default function DashboardPage() {
  return (
    <I18nPreload namespaces={["dashboard"]}>
      <DashboardPageContent />
    </I18nPreload>
  );
}
