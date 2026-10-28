"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { EllipsisVertical } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NumberInput } from "@/components/number-input";
import { usePrinter } from "@/features/print/print-button";
import { voucherData } from "@/features/print/print-data";
import { SALES_KEYS } from "@/features/sales/sales-queries";
import type { InvoiceList } from "@/features/sales/sales-types";
import { api } from "@/lib/api-client";
import { formatMoney } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { saleNs } from "@/messages/sale";
import { SaleCustomerPicker } from "./sale-customer-picker";
import { isNetworkError } from "./sale-storage";
import { usePaymentMethodLabel, SALE_PAYMENT_METHODS, underlineInput } from "./sale-ui-parts";
import type { DraftInvoice, SaleCustomer } from "./sale-types";

const nowLocal = () => { const d = new Date(); d.setSeconds(0, 0); return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16); };
const FUND = { CASH: "CASH", TRANSFER: "BANK", CARD: "BANK", EWALLET: "EWALLET" } as const;

/**
 * "Lập phiếu thu" (thu nợ khách): POST /customers/{id}/payments, tự phân bổ vào hóa đơn còn nợ cũ trước.
 * Tổng thanh toán cho hóa đơn = phần phân bổ được vào hóa đơn còn nợ; Trừ vào công nợ = toàn bộ số thu. Cần mạng.
 */
export function SaleReceiptDialog({ branchId, userName, onClose }: { branchId: string; userName: string; onClose: () => void }) {
  const qc = useQueryClient();
  const t = useT(saleNs);
  const tc = useT(commonNs);
  const methodLabel = usePaymentMethodLabel();
  const print = usePrinter();
  const [customer, setCustomer] = useState<SaleCustomer | null>(null);
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<DraftInvoice["paymentMethod"]>("CASH");
  const [at, setAt] = useState(nowLocal);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: unpaid = 0 } = useQuery({
    queryKey: ["sale-unpaid-invoices", customer?.id], enabled: !!customer,
    queryFn: async () => {
      const r = await api<InvoiceList>(`/invoices?customerId=${customer!.id}&statuses=COMPLETED&size=1`);
      return Math.max(0, Number(r.sumTotal) - Number(r.sumPaid));
    },
  });
  const debt = customer?.debt ?? 0;
  const toInvoices = Math.min(amount, unpaid);

  async function submit(andPrint: boolean) {
    if (!customer) return toast.error(t("receipt.customerRequired"));
    if (amount <= 0) return toast.error(t("receipt.amountRequired"));
    setBusy(true);
    try {
      const occurredAt = at ? new Date(at).toISOString() : new Date().toISOString();
      const r = await api<{ code: string }>(`/customers/${customer.id}/payments`, { method: "POST",
        body: { branchId, occurredAt, paymentMethod: method, amount, note: note.trim() || null, allocate: true } });
      toast.success(t("receipt.created", { code: r.code, amount: formatMoney(amount) }));
      SALES_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: k }));
      if (andPrint) print("CASH_RECEIPT", voucherData({ code: r.code, voucherType: "RECEIPT", occurredAt, partnerName: customer.name,
        partnerPhone: customer.phone, category: "Thu Tiền khách trả", amount, fund: FUND[method], note: note.trim() || null, createdByName: userName }), branchId);
      onClose();
    } catch (e) {
      toast.error(isNetworkError(e) ? t("receipt.offline") : (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const row = "flex min-h-8 items-center justify-between gap-3";
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-5 p-7 text-[13px] sm:max-w-[758px]">
        <DialogHeader><DialogTitle className="text-[15px] font-bold">{t("menu.receipt")}</DialogTitle></DialogHeader>
        <div className="w-[342px]"><SaleCustomerPicker inputId="sale-receipt-customer" value={customer} branchId={branchId} onChange={setCustomer} /></div>
        <div className="grid grid-cols-2 gap-x-5">
          <div className="space-y-2">
            <div className={row}>
              <span className="font-bold">{t("receipt.amountLabel")}<span className="block text-xs font-normal text-[#4b5563]">{methodLabel(method)}</span></span>
              <DropdownMenu>
                <DropdownMenuTrigger aria-label={t("receipt.method")} className="grid size-6 place-items-center rounded hover:bg-muted"><EllipsisVertical className="size-4" /></DropdownMenuTrigger>
                <DropdownMenuContent className="w-40 p-1">
                  {SALE_PAYMENT_METHODS.map((m) => <DropdownMenuItem key={m} className="py-2 text-[13px]" onClick={() => setMethod(m)}>{methodLabel(m)}</DropdownMenuItem>)}
                </DropdownMenuContent>
              </DropdownMenu>
              <NumberInput aria-label={t("receipt.amount")} autoFocus className={`${underlineInput} flex-1`} value={amount} onValueChange={setAmount} />
            </div>
            <div className={row}><span className="font-bold">{t("receipt.debtAfter")}</span><span>{formatMoney(debt - amount)}</span></div>
          </div>
          <div className="space-y-2">
            <div className={row}><span className="w-20 font-bold">{t("dialogs.time")}</span>
              <DateTimePicker aria-label={t("dialogs.time")} className={`${underlineInput} w-[150px]`} value={at} onChange={setAt} />
              <span className="flex-1" /></div>
            <div className={row}><span className="w-20 font-bold">{tc("fields.note")}</span>
              <input aria-label={tc("fields.note")} placeholder={tc("fields.note")} value={note} onChange={(e) => setNote(e.target.value)}
                className="h-9 flex-1 border-b border-[#c8ccd2] bg-transparent outline-none placeholder:text-[#6b7280] focus:border-primary" /></div>
            <div className={`${row} pt-6 pl-24`}><span>{t("receipt.toInvoices")}</span><span>{formatMoney(toInvoices)}</span></div>
            <div className={`${row} pl-24`}><span>{t("receipt.toDebt")}</span><span>{formatMoney(amount)}</span></div>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="outline" className="h-9 border-primary px-6 text-primary" onClick={onClose}>{tc("actions.skip")}</Button>
          <Button className="h-9 px-5 font-bold" disabled={busy} onClick={() => submit(false)}>{t("receipt.create")}</Button>
          <Button className="h-9 px-5 font-bold" disabled={busy} onClick={() => submit(true)}>{t("receipt.createPrint")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
