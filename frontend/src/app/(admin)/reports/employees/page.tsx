import { PartyReport } from "@/features/reports/party-report";
import { EMPLOYEE_REPORT } from "@/features/reports/party-report-configs";

export default function EmployeesReportPage() {
  return <PartyReport cfg={EMPLOYEE_REPORT} />;
}
