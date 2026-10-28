import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { MobileClockScreen } from "@/features/hr/mobile-clock-screen";
import { getRequestLocale, loadServerMessages } from "@/lib/i18n/server";
import vi from "@/messages/vi/hr.json";

/** Tiêu đề tab theo ngôn ngữ đang chọn (cookie), thiếu bản dịch → tiếng Việt. */
export async function generateMetadata(): Promise<Metadata> {
  const messages = await loadServerMessages(await getRequestLocale(), ["hr"]);
  const title = (messages.hr as typeof vi | undefined)?.mobile?.title ?? vi.mobile.title;
  return { title };
}
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

/** Chấm công trên điện thoại — ngoài layout quản lý (không có menu xanh), cần đăng nhập. ?t= token QR chi nhánh. */
export default function ClockPage() {
  return <Suspense><MobileClockScreen /></Suspense>;
}
