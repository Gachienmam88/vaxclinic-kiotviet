"use client";

import { cn } from "@/lib/utils";
import { kvInput, kvLabel } from "./customer-ui-primitives";
import { useBankAccounts } from "./sales-queries";

export type RefundMethod = "CASH" | "TRANSFER" | "CREDIT";
export type RefundChoice = { method: RefundMethod; bankAccountId: string };

const LABELS: [RefundMethod, string][] = [
  ["CASH", "Hoàn tiền mặt"], ["TRANSFER", "Hoàn chuyển khoản"], ["CREDIT", "Giữ làm công nợ (khách trả trước)"],
];

/**
 * Chọn cách xử lý tiền khách đã trả khi hủy / hoàn: tiền mặt, chuyển khoản (chọn tài khoản) hoặc giữ làm công nợ
 * (không lập phiếu chi, công nợ khách âm = tiền trả trước dùng cho lần mua sau). allowCredit = false với khách lẻ.
 */
export function RefundMethodFields({ value, onChange, allowCredit = true }:
  { value: RefundChoice; onChange: (v: RefundChoice) => void; allowCredit?: boolean }) {
  const { data: banks = [] } = useBankAccounts();
  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-1.5 text-[13px]">
        {LABELS.filter(([k]) => k !== "CREDIT" || allowCredit).map(([k, label]) => (
          <label key={k} className="flex items-center gap-1.5">
            <input type="radio" className="accent-primary" checked={value.method === k} onChange={() => onChange({ ...value, method: k })} />{label}
          </label>))}
      </div>
      {value.method === "TRANSFER" && (
        <label className="block space-y-1"><span className={kvLabel}>Tài khoản chi</span>
          <select aria-label="Tài khoản chi" className={cn(kvInput, "w-full border px-2")} value={value.bankAccountId}
            onChange={(e) => onChange({ ...value, bankAccountId: e.target.value })}>
            <option value="">-- Không chọn --</option>
            {banks.map((b) => <option key={b.id} value={b.id}>{b.bankName} - {b.accountNo}</option>)}
          </select></label>)}
    </div>
  );
}
