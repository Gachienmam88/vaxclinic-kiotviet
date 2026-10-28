"use client";

import { formatDateTime, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CsvExportButton, downloadCsv } from "./customer-csv-export";
import { kvSubHead, kvSubRow, kvSubTable } from "./customer-ui-primitives";
import { useInvoices } from "./sales-queries";

const STATUS = { COMPLETED: "Hoàn thành", CANCELLED: "Đã hủy" } as const;

/** Tab "Lịch sử bán/trả hàng": hóa đơn của khách (50 gần nhất) + xuất CSV danh sách đang hiển thị. */
export function CustomerDetailSalesTab({ customerId, customerCode }: { customerId: string; customerCode: string }) {
  const { data } = useInvoices(new URLSearchParams({ customerId, size: "50" }));
  const items = data?.items ?? [];
  const exportCsv = () => downloadCsv(`lich-su-ban-hang-${customerCode}.csv`, ["Mã hóa đơn", "Thời gian", "Người bán", "Tổng cộng", "Trạng thái"],
    items.map((i) => [i.code, formatDateTime(i.soldAt), i.sellerName, i.total, STATUS[i.status]]));
  return (
    <div>
      <table className={kvSubTable}>
        <thead className={kvSubHead}><tr><th>Mã hóa đơn</th><th>Thời gian</th><th>Người bán</th>
          <th className="text-right">Tổng cộng</th><th className="w-32">Trạng thái</th></tr></thead>
        <tbody>
          {!items.length && <tr className={kvSubRow}><td colSpan={5} className="text-center text-muted-foreground">Chưa có giao dịch</td></tr>}
          {items.map((i) => (
            <tr key={i.id} className={kvSubRow}>
              <td className="text-primary">{i.code}</td><td>{formatDateTime(i.soldAt)}</td>
              <td>{i.sellerName}</td><td className="text-right">{formatMoney(i.total)}</td>
              <td><span className={cn("rounded px-1.5 py-0.5 text-[11px] font-semibold",
                i.status === "COMPLETED" ? "bg-[#e6f7ee] text-[#00a650]" : "bg-destructive/10 text-destructive")}>{STATUS[i.status]}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-8 border-t pt-3"><CsvExportButton disabled={!items.length} onClick={exportCsv} /></div>
    </div>
  );
}
