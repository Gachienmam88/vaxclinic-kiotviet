"use client";

import { useState } from "react";
import { Calculator, CircleDollarSign, PencilLine, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DocCodeLink } from "@/components/ui/doc-code-link";
import { ListEmptyRow } from "@/components/ui/list-empty-state";
import { formatDateTime, formatMoney } from "@/lib/format";
import { useCurrentUser } from "@/lib/use-current-user";
import { CsvExportButton, downloadCsv } from "./customer-csv-export";
import { kvSubHead, kvSubRow, kvSubTable } from "./customer-ui-primitives";
import { DebtDialog } from "./debt-dialogs";
import { QrPaymentDialog } from "./qr-payment-dialog";
import { useCustomerDebts } from "./sales-queries";
import { DEBT_TYPE_LABEL, type Customer } from "./sales-types";
import { useT } from "@/lib/i18n";
import { customersNs } from "@/messages/customers";
import { enumLabel } from "./i18n-enum-label";

const actionBtn = "h-8 rounded-md px-3 text-[13px] font-semibold";

/**
 * Tab "Nợ cần thu từ khách": sổ công nợ (lọc theo loại giao dịch) + Thanh toán / Điều chỉnh / Chiết khấu / Tạo QR.
 * File CSV công nợ là sổ kế toán → giữ tiêu đề cột tiếng Việt ở mọi ngôn ngữ; nội dung CK QR (ASCII) cũng giữ nguyên.
 */
export function CustomerDetailDebtTab({ c }: { c: Customer }) {
  const t = useT(customersNs);
  const { data = [] } = useCustomerDebts(c.id);
  const { can } = useCurrentUser();
  const [dialog, setDialog] = useState<"payment" | "discount" | "adjust" | null>(null);
  const [qr, setQr] = useState(false);
  const [docType, setDocType] = useState("");
  const rows = docType ? data.filter((d) => d.docType === docType) : data;
  const exportCsv = () => downloadCsv(`cong-no-${c.code}.csv`, ["Mã phiếu", "Thời gian", "Loại", "Giá trị", "Dư nợ khách hàng", "Ghi chú"],
    rows.map((d) => [d.docCode, formatDateTime(d.occurredAt), DEBT_TYPE_LABEL[d.docType] ?? d.docType, d.amount, d.balanceAfter, d.note]));
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <select aria-label={t("debtTab.filterAria")} value={docType} onChange={(e) => setDocType(e.target.value)}
          className="h-8 w-[150px] rounded-md border border-[#d9dbe0] bg-white px-2.5 text-[13px] outline-none focus:border-primary">
          <option value="">{t("debtTab.allTypes")}</option>
          {Object.keys(DEBT_TYPE_LABEL).map((v) => <option key={v} value={v}>{enumLabel(t, customersNs, "enums.debtType", v)}</option>)}
        </select>
      </div>
      <table className={kvSubTable}>
        <thead className={kvSubHead}><tr><th>{t("debtTab.cols.code")}</th><th>{t("debtTab.cols.time")}</th><th>{t("debtTab.cols.type")}</th>
          <th className="text-right">{t("debtTab.cols.amount")}</th><th className="text-right">{t("debtTab.cols.balance")}</th></tr></thead>
        <tbody>
          {!rows.length && <ListEmptyRow cols={5} what={t("debtTab.emptyWhat")} compact />}
          {rows.map((d) => (
            <tr key={d.id} className={kvSubRow}>
              <td><DocCodeLink code={d.docCode} /></td><td>{formatDateTime(d.occurredAt)}</td>
              <td>{enumLabel(t, customersNs, "enums.debtType", d.docType)}</td>
              <td className="text-right">{formatMoney(d.amount)}</td><td className="text-right">{formatMoney(d.balanceAfter)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap items-center gap-2 border-t pt-3">
        <CsvExportButton label={t("debtTab.exportDebt")} disabled={!rows.length} onClick={exportCsv} />
        <div className="ml-auto flex flex-wrap gap-2">
          <Button className={actionBtn} onClick={() => setDialog("payment")}><CircleDollarSign className="size-4" /> {t("debtTab.pay")}</Button>
          {can("cashbook.manage") && <>
            <Button variant="outline" className={actionBtn} onClick={() => setDialog("adjust")}><PencilLine className="size-4" /> {t("debtTab.adjust")}</Button>
            <Button variant="outline" className={actionBtn} onClick={() => setDialog("discount")}><Calculator className="size-4" /> {t("debtTab.discount")}</Button>
          </>}
          <Button variant="outline" className={actionBtn} onClick={() => setQr(true)}><QrCode className="size-4" /> {t("debtTab.createQr")}</Button>
        </div>
      </div>
      {dialog && <DebtDialog kind={dialog} customer={c} onClose={() => setDialog(null)} />}
      {qr && <QrPaymentDialog amount={Math.max(Number(c.debt), 0)} info={`${c.code} thanh toan no`} onClose={() => setQr(false)} />}
    </div>
  );
}
