"use client";

// Cấu hình báo cáo chứa hàm text(t) → không truyền được qua ranh giới Server → Client Component; trang render phía client.
import { PartyReport } from "@/features/reports/party-report";
import { EMPLOYEE_REPORT } from "@/features/reports/party-report-configs";

export default function EmployeesReportPage() {
  return <PartyReport cfg={EMPLOYEE_REPORT} />;
}
