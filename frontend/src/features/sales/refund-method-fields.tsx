"use client";

import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { salesNs } from "@/messages/sales";
import { kvInput, kvLabel } from "./customer-ui-primitives";
import { useBankAccounts } from "./sales-queries";

export type RefundMethod = "CASH" | "TRANSFER" | "CREDIT";
export type RefundChoice = { method: RefundMethod; bankAccountId: string };

const METHODS: RefundMethod[] = ["CASH", "TRANSFER", "CREDIT"];

/**
 * Chọn cách xử lý tiền khách đã trả khi hủy / hoàn: tiền mặt, chuyển khoản (chọn tài khoản) hoặc giữ làm công nợ
 * (không lập phiếu chi, công nợ khách âm = tiền trả trước dùng cho lần mua sau). allowCredit = false với khách lẻ.
 */
export function RefundMethodFields({ value, onChange, allowCredit = true }:
  { value: RefundChoice; onChange: (v: RefundChoice) => void; allowCredit?: boolean }) {
  const t = useT(salesNs);
  const { data: banks = [] } = useBankAccounts();
  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-1.5 text-[13px]">
        {METHODS.filter((k) => k !== "CREDIT" || allowCredit).map((k) => (
          <label key={k} className="flex items-center gap-1.5">
            <input type="radio" className="accent-primary" checked={value.method === k} onChange={() => onChange({ ...value, method: k })} />{t(`enums.refundMethod.${k}`)}
          </label>))}
      </div>
      {value.method === "TRANSFER" && (
        <label className="block space-y-1"><span className={kvLabel}>{t("refund.account")}</span>
          <select aria-label={t("refund.account")} className={cn(kvInput, "w-full border px-2")} value={value.bankAccountId}
            onChange={(e) => onChange({ ...value, bankAccountId: e.target.value })}>
            <option value="">{t("refund.none")}</option>
            {banks.map((b) => <option key={b.id} value={b.id}>{b.bankName} - {b.accountNo}</option>)}
          </select></label>)}
    </div>
  );
}
