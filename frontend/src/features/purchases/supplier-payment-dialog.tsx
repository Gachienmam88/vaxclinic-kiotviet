"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/number-input";
import {
  KvChip, kvDialog, kvDialogBody, kvDialogFooter, kvDialogHeader, kvDialogTitle, kvFooterBtn, kvInput, kvLabel,
} from "@/features/sales/customer-ui-primitives";
import { useBankAccounts } from "@/features/sales/sales-queries";
import { api, errorMessage } from "@/lib/api-client";
import { formatMoney } from "@/lib/format";
import { useCurrentUser } from "@/lib/use-current-user";
import { cn } from "@/lib/utils";
import { fromLocalInput, toLocalInput } from "./purchase-line-form";
import { useUserLookup } from "./purchase-queries";
import { ReceiptViewDialog } from "./receipt-view-dialog";
import { allocationPayload, distributeOldestFirst, setRow, sumAllocation, type Allocation } from "./supplier-allocation-math";
import { SupplierAllocationTable } from "./supplier-allocation-table";
import { useSupplierPaymentPrinter } from "./supplier-payment-print";
import { useInvalidateSuppliers, useUnpaidReceipts } from "./supplier-queries";
import { SUPPLIER_PAYMENT_METHODS, type SupplierDebtDoc, type SupplierRow } from "./supplier-types";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { purchasesNs } from "@/messages/purchases";

const select = "h-8 w-full rounded-md border border-[#d9dbe0] bg-white px-2.5 text-[13px] outline-none focus:border-primary";

/**
 * Popup "Thanh toán" (phiếu chi trả NCC) và "Chiết khấu thanh toán". Gõ "Số tiền" → tự phân bổ phiếu cũ trước;
 * gõ từng dòng → mỗi dòng tối đa "Còn cần trả", ô "Số tiền" = tổng các dòng. Dư so với tổng nợ phiếu = chưa phân bổ.
 */
export function SupplierPaymentDialog({ kind, supplier, onClose }: { kind: "payment" | "discount"; supplier: SupplierRow; onClose: () => void }) {
  const pay = kind === "payment";
  const invalidate = useInvalidateSuppliers();
  const printVoucher = useSupplierPaymentPrinter();
  const { data: me } = useCurrentUser();
  const t = useT(purchasesNs);
  const tc = useT(commonNs);
  const { data: users = [] } = useUserLookup();
  const { data: accounts = [] } = useBankAccounts();
  const { data: receipts } = useUnpaidReceipts(supplier.id);
  const [at, setAt] = useState(toLocalInput(new Date().toISOString()));
  const [staffId, setStaffId] = useState(me?.user.id ?? "");
  const [method, setMethod] = useState("CASH");
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState("");
  const [allocate, setAllocate] = useState(pay);
  const [manual, setManual] = useState<Allocation | null>(null);
  const [viewReceipt, setViewReceipt] = useState<string | null>(null);
  const alloc = manual ?? distributeOldestFirst(amount, receipts ?? []);
  const allocated = allocate ? sumAllocation(alloc) : 0;
  const wallets = accounts.filter((a) => a.kind === "EWALLET");
  const banks = accounts.filter((a) => a.kind !== "EWALLET");
  const methodAccounts = method === "TRANSFER" ? banks : method === "EWALLET" ? wallets : [];

  const save = useMutation<SupplierDebtDoc, Error, boolean>({
    mutationFn: () => api<SupplierDebtDoc>(`/suppliers/${supplier.id}/${pay ? "payments" : "discounts"}`, { method: "POST", body: {
      branchId: me?.user.branches[0]?.id, occurredAt: fromLocalInput(at), staffId: staffId || null,
      staffName: users.find((u) => u.id === staffId)?.fullName, paymentMethod: pay ? method : null,
      bankAccountId: pay && method !== "CASH" ? accountId || null : null, amount, note, allocate,
      allocations: allocate ? allocationPayload(alloc) : null,
    } }),
    onSuccess: (doc, print) => {
      toast.success(t(pay ? "suppliers.payment.toastPayment" : "suppliers.payment.toastDiscount", { code: doc.code }));
      invalidate();
      if (print) printVoucher(doc, supplier.phone);
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const invalid = save.isPending || amount <= 0 || !me?.user.branches.length;
  const onAmount = (v: number) => { setAmount(v); setManual(null); };
  const onRow = (r: Parameters<typeof setRow>[1], v: number) => {
    const next = setRow(alloc, r, v);
    setManual(next);
    setAmount(sumAllocation(next));
  };
  const amountInput = <NumberInput autoFocus aria-label={pay ? t("suppliers.payment.amount") : t("suppliers.payment.discountFromSupplier")} className={kvInput}
    value={amount} onValueChange={onAmount} />;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={cn(kvDialog, "flex max-h-[92vh] flex-col sm:max-w-[857px]")}>
        <DialogHeader className={cn(kvDialogHeader, "gap-1")}>
          <DialogTitle className={kvDialogTitle}>{pay ? t("suppliers.payment.titlePay") : t("suppliers.doc.titleDiscount")}</DialogTitle>
          <p className="flex items-center gap-1.5 text-[12px] text-foreground/70">
            {supplier.name} <span>·</span> <KvChip>{t("suppliers.payment.currentDebt", { amount: formatMoney(supplier.debt) })}</KvChip></p>
        </DialogHeader>
        <div className={cn(kvDialogBody, "overflow-y-auto")}>
          <div className="grid grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-2">
            <div className="grid gap-1.5"><Label className={kvLabel}>{t("receipts.cols.time")}</Label>
              <DateTimePicker aria-label={t("receipts.cols.time")} className={kvInput} value={at} onChange={(v) => setAt(v)} /></div>
            <div className="grid gap-1.5"><Label className={kvLabel}>{pay ? t("suppliers.payment.payer") : t("suppliers.doc.performer")}</Label>
              <select className={select} aria-label={pay ? t("suppliers.payment.payer") : t("suppliers.doc.performer")} value={staffId} onChange={(e) => setStaffId(e.target.value)}>
                {users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
              </select></div>
            {pay && <>
              <div className="grid gap-1.5"><Label className={kvLabel}>{t("panel.paymentMethod")}</Label>
                <select className={select} aria-label={t("panel.paymentMethod")} value={method} onChange={(e) => { setMethod(e.target.value); setAccountId(""); }}>
                  {SUPPLIER_PAYMENT_METHODS.filter(([v]) => v !== "EWALLET" || wallets.length).map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}
                </select></div>
              {method !== "CASH" ? (
                <div className="grid gap-1.5"><Label className={kvLabel}>{method === "TRANSFER" ? t("suppliers.payment.bankAccount") : t("payMethods.ewallet")}</Label>
                  <select className={select} aria-label={t("suppliers.payment.account")} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                    <option value="">{t("suppliers.payment.pickAccount")}</option>
                    {methodAccounts.map((b) => <option key={b.id} value={b.id}>{b.bankName} - {b.accountNo} - {b.accountName}</option>)}
                  </select></div>
              ) : <div />}
              <div className="grid gap-1.5"><Label className={kvLabel}>{t("suppliers.payment.amount")}</Label>{amountInput}</div>
              <div className="grid gap-1.5"><Label className={kvLabel}>{t("suppliers.payment.debtLeft")}</Label>
                <Input readOnly aria-label={t("suppliers.payment.debtLeft")} className={cn(kvInput, "bg-[#eff0f3] text-right")} value={formatMoney(supplier.debt - amount)} /></div>
            </>}
            {!pay && (
              <div className="grid gap-1.5 md:col-span-2"><Label className={kvLabel}>{t("suppliers.payment.discountFromSupplier")}</Label>{amountInput}
                <span className="text-right text-[11px] text-muted-foreground">{t("suppliers.payment.stillOwed", { amount: formatMoney(supplier.debt - amount) })}</span></div>
            )}
            <div className="grid gap-1.5 md:col-span-2"><Label className={kvLabel}>{tc("fields.note")}</Label>
              <Input placeholder={t("suppliers.doc.notePlaceholder")} aria-label={tc("fields.note")} className={kvInput} value={note} onChange={(e) => setNote(e.target.value)} /></div>
          </div>
          <label className="flex w-fit cursor-pointer items-center gap-2 py-1 text-[13px]">
            <Checkbox checked={allocate} onCheckedChange={(v) => setAllocate(v === true)} /> {t("suppliers.payment.allocate")}
          </label>
          {allocate && <SupplierAllocationTable kind={kind} receipts={receipts} alloc={alloc} unallocated={Math.max(amount - allocated, 0)}
            onRow={onRow} onOpen={setViewReceipt} />}
        </div>
        <DialogFooter className={kvDialogFooter}>
          <Button variant="outline" className={kvFooterBtn} onClick={onClose}>{tc("actions.skip")}</Button>
          {pay && <Button variant="outline" className={kvFooterBtn} disabled={invalid} onClick={() => save.mutate(true)}>{t("suppliers.payment.createAndPrint")}</Button>}
          <Button className={kvFooterBtn} disabled={invalid} onClick={() => save.mutate(false)}>{pay ? t("suppliers.payment.createPayment") : t("suppliers.payment.createDoc")}</Button>
        </DialogFooter>
      </DialogContent>
      {viewReceipt && <ReceiptViewDialog id={viewReceipt} onClose={() => setViewReceipt(null)} />}
    </Dialog>
  );
}
