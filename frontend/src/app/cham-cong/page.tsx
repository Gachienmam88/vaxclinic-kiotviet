import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { MobileClockScreen } from "@/features/hr/mobile-clock-screen";

export const metadata: Metadata = { title: "Chấm công" };
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

/** Chấm công trên điện thoại — ngoài layout quản lý (không có menu xanh), cần đăng nhập. ?t= token QR chi nhánh. */
export default function ClockPage() {
  return <Suspense><MobileClockScreen /></Suspense>;
}
