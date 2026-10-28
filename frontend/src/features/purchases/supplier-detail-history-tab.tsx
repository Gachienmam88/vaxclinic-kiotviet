"use client";

import { useState } from "react";
import { DOC_CODE_LINK_CLASS } from "@/components/ui/doc-code-link";
import { ListEmptyState } from "@/components/ui/list-empty-state";
import { CsvExportButton, downloadCsv } from "@/features/sales/customer-csv-export";
import { kvSubHead, kvSubRow, kvSubTable } from "@/features/sales/customer-ui-primitives";
import { formatDateTime, formatMoney } from "@/lib/format";
import { DocStatusBadge } from "./purchase-list-chrome";
import { receiptStatusLabels, returnStatusLabels, type PurchasesT } from "./purchase-types";
import { SupplierDocOpener, type OpenDoc } from "./supplier-doc-opener";
import { SupplierMiniPager } from "./supplier-mini-pager";
import { useSupplierHistory } from "./supplier-queries";
import type { SupplierHistoryRow, SupplierRow } from "./supplier-types";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { purchasesNs } from "@/messages/purchases";

const PAGE = 10;
const statusLabel = (h: SupplierHistoryRow, t: PurchasesT) => (h.kind === "RECEIPT" ? receiptStatusLabels : returnStatusLabels)(t)[h.status];

/** Tab "Lịch sử nhập/trả hàng": phiếu nhập + trả hàng nhập của NCC, bấm mã để mở phiếu. */
export function SupplierDetailHistoryTab({ s }: { s: SupplierRow }) {
  const { data } = useSupplierHistory(s.id);
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<OpenDoc | null>(null);
  const t = useT(purchasesNs);
  const tc = useT(commonNs);
  const rows = data ?? [];
  const header = [t("suppliers.history.docCode"), t("receipts.cols.time"), tc("fields.createdBy"), t("summary.total"), tc("fields.status")];
  return (
    <div className="space-y-3">
      <div>
        <table className={kvSubTable}>
          <thead className={kvSubHead}><tr><th>{header[0]}</th><th>{header[1]}</th><th>{header[2]}</th>
            <th className="text-right">{header[3]}</th><th>{header[4]}</th></tr></thead>
          <tbody>
            {!data && <tr className={kvSubRow}><td colSpan={5} className="text-center text-muted-foreground">{tc("status.loading")}</td></tr>}
            {data && !rows.length && <tr><td colSpan={5}><ListEmptyState compact what={t("suppliers.history.emptyWhat")} /></td></tr>}
            {rows.slice(page * PAGE, (page + 1) * PAGE).map((h) => (
              <tr key={h.id} className={kvSubRow}>
                <td><button type="button" className={DOC_CODE_LINK_CLASS}
                  onClick={() => setOpen({ type: h.kind === "RECEIPT" ? "PURCHASE" : "PURCHASE_RETURN", id: h.id })}>{h.code}</button></td>
                <td>{formatDateTime(h.time)}</td><td>{h.createdByName}</td>
                <td className="text-right">{formatMoney(h.total)}</td>
                <td><DocStatusBadge status={h.status} label={statusLabel(h, t)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <SupplierMiniPager page={page} size={PAGE} total={rows.length} onPage={setPage} />
      </div>
      <div className="border-t pt-3">
        <CsvExportButton disabled={!rows.length} onClick={() => downloadCsv(`lich-su-nhap-tra-${s.code}.csv`,
          header, rows.map((h) => [h.code, formatDateTime(h.time), h.createdByName, h.total, statusLabel(h, t)]))} />
      </div>
      <SupplierDocOpener doc={open} onClose={() => setOpen(null)} />
    </div>
  );
}
