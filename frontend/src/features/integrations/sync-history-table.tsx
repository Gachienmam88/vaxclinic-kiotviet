"use client";

import { kvSubHead, kvSubRow, kvSubTable } from "@/features/sales/customer-ui-primitives";
import { formatDate, formatDateTime } from "@/lib/format";
import { useSyncLogs } from "./integration-queries";
import { useT } from "@/lib/i18n";
import { inputInvoicesNs } from "@/messages/input-invoices";

/** Tab "Lịch sử đồng bộ": mỗi lần bấm Đồng bộ (thành công / lỗi), mới nhất trước. */
export function SyncHistoryTable({ active }: { active: boolean }) {
  const t = useT(inputInvoicesNs);
  const { data, isLoading } = useSyncLogs(active);
  return (
    <div className="max-h-[50vh] overflow-auto">
      <table className={kvSubTable}>
        <thead className={kvSubHead}><tr>
          <th>{t("history.time")}</th><th>{t("history.taxCode")}</th><th>{t("history.range")}</th>
          <th className="text-right">{t("history.foundAdded")}</th><th>{t("history.result")}</th><th>{t("history.user")}</th></tr></thead>
        <tbody>
          {isLoading && <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">{t("common.loading")}</td></tr>}
          {data && !data.length && <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">{t("history.empty")}</td></tr>}
          {data?.map((l) => (
            <tr key={l.id} className={kvSubRow}>
              <td className="whitespace-nowrap">{formatDateTime(l.createdAt)}</td><td>{l.taxCode}</td>
              <td className="whitespace-nowrap">{formatDate(l.from)} – {formatDate(l.to)}</td>
              <td className="text-right">{l.found} / {l.added}</td>
              <td className={l.status === "SUCCESS" ? "text-[#0f9d58]" : "max-w-64 text-destructive"}>
                {l.status === "SUCCESS" ? t("history.success") : l.error ?? t("history.failed")}</td>
              <td>{l.userName ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
