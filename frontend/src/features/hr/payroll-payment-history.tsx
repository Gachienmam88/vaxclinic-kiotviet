"use client";

import { api } from "@/lib/api-client";
import { formatDateTime, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useHrMutation } from "./hr-queries";
import type { PayrollPayment } from "./hr-types";
import { DocCodeLink } from "@/components/ui/doc-code-link";
import { ListEmptyRow } from "@/components/ui/list-empty-state";
import { useT } from "@/lib/i18n";
import { hrNs } from "@/messages/hr";

/** Lịch sử thanh toán lương: mỗi phiếu PCPL… tương ứng 1 phiếu chi trong Sổ quỹ (phần tiền mặt / CK). */
export function PayrollPaymentHistory({ payments }: { payments: PayrollPayment[] }) {
  const t = useT(hrNs);
  const cancel = useHrMutation((id: string) => api(`/hr/payrolls/payments/${id}/cancel`, { method: "POST" }), t("payments.toastCancelled"));
  return (
    <section className="rounded-lg bg-white">
      <h2 className="border-b border-[#eceef1] px-4 py-3 text-[15px] font-semibold">{t("payments.title")}</h2>
      <table className="w-full text-[13px]">
        <thead><tr className="bg-[#eff0f3] text-left [&_th]:h-[30px] [&_th]:px-3 [&_th]:font-semibold">
          <th>{t("payments.cols.code")}</th><th>{t("payments.cols.employee")}</th><th className="text-right">{t("payments.cols.cashBank")}</th>
          <th className="text-right">{t("payments.cols.advanceDeducted")}</th><th>{t("payments.cols.method")}</th><th>{t("payments.cols.time")}</th>
          <th>{t("payments.cols.createdBy")}</th><th>{t("payments.cols.status")}</th><th />
        </tr></thead>
        <tbody>
          {!payments.length && <ListEmptyRow cols={9} what={t("payments.emptyWhat")} compact />}
          {payments.map((p) => (
            <tr key={p.id} className={cn("border-b border-[#eceef1] [&_td]:px-3 [&_td]:py-2", p.cancelled && "text-muted-foreground line-through")}>
              <td><DocCodeLink code={p.code} /></td><td>{p.employeeName}</td>
              <td className="text-right">{formatMoney(p.cashAmount)}</td><td className="text-right">{formatMoney(p.advanceAmount)}</td>
              <td>{p.method === "BANK" ? t("fund.bank") : t("fund.cash")}</td><td>{formatDateTime(p.paidAt)}</td><td>{p.createdByName}</td>
              <td className="no-underline">{p.cancelled ? t("payments.cancelled") : t("payments.paid")}</td>
              <td className="text-right">
                {!p.cancelled && (
                  <button type="button" className="text-destructive hover:underline" disabled={cancel.isPending}
                    onClick={() => confirm(t("payments.confirmCancel", { code: p.code })) && cancel.mutate(p.id)}>
                    {t("payments.cancel")}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
