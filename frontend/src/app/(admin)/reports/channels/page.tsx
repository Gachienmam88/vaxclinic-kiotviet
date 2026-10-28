import { PartyReport } from "@/features/reports/party-report";
import { CHANNEL_REPORT } from "@/features/reports/party-report-configs";

export default function ChannelsReportPage() {
  return <PartyReport cfg={CHANNEL_REPORT} />;
}
