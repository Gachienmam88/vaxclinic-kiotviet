"use client";

import { useEffect, useState } from "react";

/**
 * Báo cáo phụ thuộc "hôm nay / lúc này" (khoảng thời gian mặc định, "Ngày lập") theo giờ máy người xem
 * → không dựng sẵn trên server (giờ build / múi giờ server khác) để tránh lệch nội dung khi hydrate.
 */
export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? children : <div className="p-6 text-sm text-muted-foreground">Đang tải báo cáo...</div>;
}
