"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { reportsNs } from "@/messages/reports";

/**
 * Báo cáo phụ thuộc "hôm nay / lúc này" (khoảng thời gian mặc định, "Ngày lập") theo giờ máy người xem
 * → không dựng sẵn trên server (giờ build / múi giờ server khác) để tránh lệch nội dung khi hydrate.
 */
export function ReportMountGate({ children }: { children: React.ReactNode }) {
  const t = useT(reportsNs);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? children : <div className="p-6 text-sm text-muted-foreground">{t("loading")}</div>;
}
