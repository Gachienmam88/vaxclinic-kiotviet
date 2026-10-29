"use client";

// Cấu hình báo cáo chứa hàm text(t) → không truyền được qua ranh giới Server → Client Component; trang render phía client.
import { PartyReport } from "@/features/reports/party-report";
import { CUSTOMER_REPORT } from "@/features/reports/party-report-configs";

export default function CustomersReportPage() {
  return <PartyReport cfg={CUSTOMER_REPORT} />;
}
