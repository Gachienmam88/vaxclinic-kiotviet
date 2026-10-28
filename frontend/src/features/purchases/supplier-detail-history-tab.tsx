"use client";

import { useState } from "react";
import { DOC_CODE_LINK_CLASS } from "@/components/ui/doc-code-link";
import { ListEmptyState } from "@/components/ui/list-empty-state";
import { CsvExportButton, downloadCsv } from "@/features/sales/customer-csv-export";
import { kvSubHead, kvSubRow, kvSubTable } from "@/features/sales/customer-ui-primitives";
import { formatDateTime, formatMoney } from "@/lib/format";
import { DocStatusBadge } from "./purchase-list-chrome";
import { RECEIPT_STATUS_LABEL, RETURN_STATUS_LABEL } from "./purchase-types";
import { SupplierDocOpener, type OpenDoc } from "./supplier-doc-opener";
import { SupplierMiniPager } from "./supplier-mini-pager";
import { useSupplierHistory } from "./supplier-queries";
import type { SupplierHistoryRow, SupplierRow } from "./supplier-types";

const PAGE = 10;
const statusLabel = (h: SupplierHistoryRow) => (h.kind === "RECEIPT" ? RECEIPT_STATUS_LABEL : RETURN_STATUS_LABEL)[h.status];

/** Tab "Lịch sử nhập/trả hàng": phiếu nhập + trả hàng nhập của NCC, bấm mã để mở phiếu. */
export function SupplierDetailHistoryTab({ s }: { s: SupplierRow }) {
  const { data } = useSupplierHistory(s.id);
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<OpenDoc | null>(null);
  const rows = data ?? [];
  return (
    <div className="space-y-3">
      <div>
        <table className={kvSubTable}>
          <thead className={kvSubHead}><tr><th>Mã phiếu</th><th>Thời gian</th><th>Người tạo</th>
            <th className="text-right">Tổng cộng</th><th>Trạng thái</th></tr></thead>
          <tbody>
            {!data && <tr className={kvSubRow}><td colSpan={5} className="text-center text-muted-foreground">Đang tải...</td></tr>}
            {data && !rows.length && <tr><td colSpan={5}><ListEmptyState compact what="phiếu nhập/trả hàng" /></td></tr>}
            {rows.slice(page * PAGE, (page + 1) * PAGE).map((h) => (
              <tr key={h.id} className={kvSubRow}>
                <td><button type="button" className={DOC_CODE_LINK_CLASS}
                  onClick={() => setOpen({ type: h.kind === "RECEIPT" ? "PURCHASE" : "PURCHASE_RETURN", id: h.id })}>{h.code}</button></td>
                <td>{formatDateTime(h.time)}</td><td>{h.createdByName}</td>
                <td className="text-right">{formatMoney(h.total)}</td>
                <td><DocStatusBadge status={h.status} label={statusLabel(h)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <SupplierMiniPager page={page} size={PAGE} total={rows.length} onPage={setPage} />
      </div>
      <div className="border-t pt-3">
        <CsvExportButton disabled={!rows.length} onClick={() => downloadCsv(`lich-su-nhap-tra-${s.code}.csv`,
          ["Mã phiếu", "Thời gian", "Người tạo", "Tổng cộng", "Trạng thái"],
          rows.map((h) => [h.code, formatDateTime(h.time), h.createdByName, h.total, statusLabel(h)]))} />
      </div>
      <SupplierDocOpener doc={open} onClose={() => setOpen(null)} />
    </div>
  );
}
