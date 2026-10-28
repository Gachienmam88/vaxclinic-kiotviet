"use client";

import { useState } from "react";
import { CircleDollarSign, PencilLine, Percent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ListEmptyState } from "@/components/ui/list-empty-state";
import { CsvExportButton, downloadCsv } from "@/features/sales/customer-csv-export";
import { kvSubHead, kvSubRow, kvSubTable } from "@/features/sales/customer-ui-primitives";
import { formatDateTime, formatMoney } from "@/lib/format";
import { useCurrentUser } from "@/lib/use-current-user";
import { SupplierAdjustDialog } from "./supplier-adjust-dialog";
import { SupplierDocOpener, type OpenDoc } from "./supplier-doc-opener";
import { SupplierMiniPager } from "./supplier-mini-pager";
import { SupplierPaymentDialog } from "./supplier-payment-dialog";
import { useSupplierDebts } from "./supplier-queries";
import { SUPPLIER_DEBT_TYPE_LABEL, type SupplierLedgerRow, type SupplierRow } from "./supplier-types";

const PAGE = 5;
const actionBtn = "h-8 rounded-md px-3 text-[13px] font-semibold";
const header = ["Mã phiếu", "Thời gian", "Loại", "Giá trị", "Nợ cần trả nhà cung cấp"];
const csvRow = (d: SupplierLedgerRow) => [d.docCode, formatDateTime(d.occurredAt), SUPPLIER_DEBT_TYPE_LABEL[d.docType], d.amount, d.balance];

/** Tab "Nợ cần trả nhà cung cấp": sổ công nợ (mới nhất trước, số dư lũy kế) + Thanh toán / Điều chỉnh / Chiết khấu thanh toán. */
export function SupplierDetailDebtTab({ s }: { s: SupplierRow }) {
  const { data } = useSupplierDebts(s.id);
  const { can } = useCurrentUser();
  const [type, setType] = useState("");
  const [page, setPage] = useState(0);
  const [dialog, setDialog] = useState<"payment" | "discount" | "adjust" | null>(null);
  const [open, setOpen] = useState<OpenDoc | null>(null);
  const all = data ?? [];
  const rows = type ? all.filter((d) => d.docType === type) : all;
  const shown = rows.slice(page * PAGE, (page + 1) * PAGE);
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <select aria-label="Lọc loại giao dịch" value={type} onChange={(e) => { setType(e.target.value); setPage(0); }}
          className="h-8 w-[170px] rounded-md border border-[#d9dbe0] bg-white px-2.5 text-[13px] outline-none focus:border-primary">
          <option value="">Tất cả giao dịch</option>
          {Object.entries(SUPPLIER_DEBT_TYPE_LABEL).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>
      </div>
      <div>
        <table className={kvSubTable}>
          <thead className={kvSubHead}><tr><th>Mã phiếu</th><th>Thời gian</th><th>Loại</th>
            <th className="text-right">Giá trị</th><th className="text-right">Nợ cần trả nhà cung cấp</th></tr></thead>
          <tbody>
            {!data && <tr className={kvSubRow}><td colSpan={5} className="text-center text-muted-foreground">Đang tải...</td></tr>}
            {data && !rows.length && <tr><td colSpan={5}><ListEmptyState compact what="giao dịch" /></td></tr>}
            {shown.map((d) => (
              <tr key={`${d.docType}-${d.docId}`} className={kvSubRow}>
                <td><button type="button" className="text-primary hover:underline" onClick={() => setOpen({ type: d.docType, id: d.docId })}>{d.docCode}</button></td>
                <td>{formatDateTime(d.occurredAt)}</td><td>{SUPPLIER_DEBT_TYPE_LABEL[d.docType]}</td>
                <td className="text-right">{formatMoney(d.amount)}</td><td className="text-right">{formatMoney(d.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <SupplierMiniPager page={page} size={PAGE} total={rows.length} onPage={setPage} />
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t pt-3">
        <CsvExportButton label="Xuất file công nợ" disabled={!all.length}
          onClick={() => downloadCsv(`cong-no-${s.code}.csv`, header, all.map(csvRow))} />
        <CsvExportButton disabled={!rows.length} onClick={() => downloadCsv(`giao-dich-${s.code}.csv`, header, rows.map(csvRow))} />
        {can("inventory.manage") && (
          <div className="ml-auto flex flex-wrap gap-2">
            <Button className={actionBtn} onClick={() => setDialog("payment")}><CircleDollarSign className="size-4" /> Thanh toán</Button>
            <Button variant="outline" className={actionBtn} onClick={() => setDialog("adjust")}><PencilLine className="size-4" /> Điều chỉnh</Button>
            <Button variant="outline" className={actionBtn} onClick={() => setDialog("discount")}><Percent className="size-4" /> Chiết khấu thanh toán</Button>
          </div>
        )}
      </div>
      {(dialog === "payment" || dialog === "discount") && <SupplierPaymentDialog kind={dialog} supplier={s} onClose={() => setDialog(null)} />}
      {dialog === "adjust" && <SupplierAdjustDialog supplier={s} onClose={() => setDialog(null)} />}
      <SupplierDocOpener doc={open} supplierPhone={s.phone} onClose={() => setOpen(null)} />
    </div>
  );
}
