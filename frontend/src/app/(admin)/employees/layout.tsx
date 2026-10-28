import { I18nPreload } from "@/lib/i18n/i18n-preload";

/** Khu vực Nhân viên: gửi sẵn chuỗi hr (+ settings vì trang thiết lập nhân viên dùng lại khung thiết lập) để F5 không nháy tiếng Việt. */
export default function EmployeesLayout({ children }: { children: React.ReactNode }) {
  return <I18nPreload namespaces={["hr", "settings"]}>{children}</I18nPreload>;
}
