"use client";

import { formatDateTime, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CsvExportButton, downloadCsv } from "./customer-csv-export";
import { kvSubHead, kvSubRow, kvSubTable } from "./customer-ui-primitives";
import { useInvoices } from "./sales-queries";
import { ListEmptyRow } from "@/components/ui/list-empty-state";
import { DocCodeLink } from "@/components/ui/doc-code-link";
import { useT } from "@/lib/i18n";
import { customersNs } from "@/messages/customers";

const STATUS_KEY = { COMPLETED: "enums.invoiceStatus.COMPLETED", CANCELLED: "enums.invoiceStatus.CANCELLED" } as const;

/** Tab "Lịch sử bán/trả hàng": hóa đơn của khách (50 gần nhất) + xuất CSV danh sách đang hiển thị (tiêu đề theo ngôn ngữ đang chọn). */
export function CustomerDetailSalesTab({ customerId, customerCode }: { customerId: string; customerCode: string }) {
  const t = useT(customersNs);
  const { data } = useInvoices(new URLSearchParams({ customerId, size: "50" }));
  const items = data?.items ?? [];
  const exportCsv = () => downloadCsv(`lich-su-ban-hang-${customerCode}.csv`, [t("salesTab.cols.code"), t("salesTab.cols.time"),
    t("salesTab.cols.seller"), t("salesTab.cols.total"), t("salesTab.cols.status")],
    items.map((i) => [i.code, formatDateTime(i.soldAt), i.sellerName, i.total, t(STATUS_KEY[i.status])]));
  return (
    <div>
      <table className={kvSubTable}>
        <thead className={kvSubHead}><tr><th>{t("salesTab.cols.code")}</th><th>{t("salesTab.cols.time")}</th><th>{t("salesTab.cols.seller")}</th>
          <th className="text-right">{t("salesTab.cols.total")}</th><th className="w-32">{t("salesTab.cols.status")}</th></tr></thead>
        <tbody>
          {!items.length && <ListEmptyRow cols={5} what={t("salesTab.emptyWhat")} compact />}
          {items.map((i) => (
            <tr key={i.id} className={kvSubRow}>
              <td><DocCodeLink code={i.code} kind="/invoices" /></td><td>{formatDateTime(i.soldAt)}</td>
              <td>{i.sellerName}</td><td className="text-right">{formatMoney(i.total)}</td>
              <td><span className={cn("rounded px-1.5 py-0.5 text-[11px] font-semibold",
                i.status === "COMPLETED" ? "bg-[#e6f7ee] text-[#00a650]" : "bg-destructive/10 text-destructive")}>{t(STATUS_KEY[i.status])}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-8 border-t pt-3"><CsvExportButton disabled={!items.length} onClick={exportCsv} /></div>
    </div>
  );
}
