import { ReportMountGate } from "@/features/reports/report-mount-gate";
import { I18nPreload } from "@/lib/i18n/i18n-preload";

/** Khu Báo cáo: tải sẵn chuỗi namespace reports (+ orders: trạng thái đơn, dashboard: đơn vị tiền rút gọn của biểu đồ) (F5 ở en/ja/zh không nháy tiếng Việt) + chỉ vẽ sau khi mount. */
export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return (
    <I18nPreload namespaces={["reports", "orders", "dashboard"]}>
      <ReportMountGate>{children}</ReportMountGate>
    </I18nPreload>
  );
}
