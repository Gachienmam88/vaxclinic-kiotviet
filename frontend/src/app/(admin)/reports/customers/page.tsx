import { PartyReport } from "@/features/reports/party-report";
import { CUSTOMER_REPORT } from "@/features/reports/party-report-configs";

export default function CustomersReportPage() {
  return <PartyReport cfg={CUSTOMER_REPORT} />;
}
