import { I18nPreload } from "@/lib/i18n/i18n-preload";

/** Chấm công điện thoại (ngoài layout quản lý): gửi sẵn chuỗi hr để lần tải đầu hiện đúng ngôn ngữ. */
export default function ClockLayout({ children }: { children: React.ReactNode }) {
  return <I18nPreload namespaces={["hr"]}>{children}</I18nPreload>;
}
