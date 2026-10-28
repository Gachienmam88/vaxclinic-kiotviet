"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/number-input";
import { fromLocalInput, toLocalInput } from "@/features/purchases/purchase-line-form";
import { useUserLookup } from "@/features/purchases/purchase-queries";
import { api, errorMessage } from "@/lib/api-client";
import { formatMoney } from "@/lib/format";
import { useCurrentUser } from "@/lib/use-current-user";
import { cn } from "@/lib/utils";
import { CustomerDebtAllocationTable } from "./customer-debt-allocation-table";
import { useDebtReceiptPrinter } from "./customer-debt-receipt-print";
import { KvChip, kvDialog, kvDialogBody, kvDialogFooter, kvDialogHeader, kvDialogTitle, kvFooterBtn, kvInput, kvLabel } from "./customer-ui-primitives";
import { SALES_KEYS } from "./sales-queries";
import { PAYMENT_METHODS, type Customer, type InvoiceList } from "./sales-types";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { customersNs } from "@/messages/customers";
import { salesNs } from "@/messages/sales";
import { enumLabel } from "./i18n-enum-label";

type Kind = "payment" | "discount" | "adjust";
type Props = { kind: Kind; customer: Customer; onClose: () => void };

const select = "h-8 w-full rounded-md border border-[#d9dbe0] bg-white px-2.5 text-[13px] outline-none focus:border-primary";

/** Hộp thoại Thanh toán / Chiết khấu thanh toán / Điều chỉnh công nợ của 1 khách hàng. */
export function DebtDialog({ kind, customer, onClose }: Props) {
  const t = useT(customersNs);
  const tc = useT(commonNs);
  const ts = useT(salesNs);
  const qc = useQueryClient();
  const { data: me } = useCurrentUser();
  const { data: users = [] } = useUserLookup();
  const printReceipt = useDebtReceiptPrinter();
  const [at, setAt] = useState(toLocalInput(new Date().toISOString()));
  const [collectorId, setCollectorId] = useState(me?.user.id ?? "");
  const [method, setMethod] = useState("CASH");
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState("");
  const [allocate, setAllocate] = useState(kind === "payment");
  const [manual, setManual] = useState<Record<string, number> | null>(null);
  const branchId = me?.user.branches[0]?.id;

  // Hóa đơn còn nợ của khách (cũ trước) để phân bổ
  const { data: unpaid } = useQuery({
    queryKey: ["unpaid-invoices", customer.id],
    queryFn: () => api<InvoiceList>(`/invoices?customerId=${customer.id}&statuses=COMPLETED&size=100`),
    enabled: kind !== "adjust",
    select: (d) => d.items.filter((i) => i.paid < i.total).sort((a, b) => a.soldAt.localeCompare(b.soldAt)),
  });
  // Tự phân bổ cũ trước, trừ khi người dùng sửa tay
  const auto = useMemo(() => {
    let left = amount;
    return Object.fromEntries((unpaid ?? []).map((i) => {
      const take = Math.max(0, Math.min(left, i.total - i.paid));
      left -= take;
      return [i.id, take];
    }));
  }, [amount, unpaid]);
  const alloc = manual ?? auto;
  const allocated = Object.values(alloc).reduce((s, v) => s + v, 0);

  const save = useMutation<{ code: string }, Error, boolean>({
    mutationFn: () => {
      if (kind === "adjust") {
        return api<{ code: string }>(`/customers/${customer.id}/adjustments`, { method: "POST", body: { occurredAt: fromLocalInput(at), newDebt: amount, note } });
      }
      return api<{ code: string }>(`/customers/${customer.id}/${kind === "payment" ? "payments" : "discounts"}`, { method: "POST", body: {
        branchId, occurredAt: fromLocalInput(at), collectorId: collectorId || null,
        collectorName: users.find((u) => u.id === collectorId)?.fullName, paymentMethod: method, amount, note, allocate,
        allocations: allocate ? Object.entries(alloc).filter(([, v]) => v > 0).map(([invoiceId, v]) => ({ invoiceId, amount: v })) : null,
      } });
    },
    onSuccess: (res, print) => {
      toast.success(t(`debtDialog.created.${kind}`));
      SALES_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: k }));
      if (print && res?.code) void printReceipt(res.code, branchId);
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const remaining = Number(customer.debt) - (kind === "adjust" ? 0 : amount);
  const invalid = save.isPending || (kind !== "adjust" && amount <= 0) || allocated > amount;
  const timeInput = <DateTimePicker aria-label={kind === "adjust" ? t("debtDialog.adjustDate") : t("debtDialog.time")} className={kvInput}
    value={at} onChange={(v) => setAt(v)} />;
  const amountInput = <NumberInput autoFocus aria-label={kind === "adjust" ? t("debtDialog.adjustValue") : kind === "payment" ? t("debtDialog.amount") : t("debtDialog.discountAmount")}
    className={kvInput} value={amount} onValueChange={(v) => { setAmount(v); setManual(null); }} />;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={cn(kvDialog, kind === "adjust" ? "sm:max-w-[438px]" : "sm:max-w-[764px]")}>
        <DialogHeader className={cn(kvDialogHeader, "gap-1")}>
          <DialogTitle className={kvDialogTitle}>{t(`debtDialog.title.${kind}`)}</DialogTitle>
          {kind !== "adjust" && <p className="flex items-center gap-1.5 text-[12px] text-foreground/70">
            {customer.name} <span>·</span> <KvChip>{t("debtDialog.currentDebt", { amount: formatMoney(customer.debt) })}</KvChip></p>}
        </DialogHeader>

        {kind === "adjust" ? (
          <div className="grid grid-cols-[130px_1fr] items-center gap-x-2 gap-y-3 px-5 pt-3 pb-6 text-[13px]">
            <span>{t("debtDialog.currentDebtLabel")}</span><span>{formatMoney(customer.debt)}</span>
            <span>{t("debtDialog.adjustDate")}</span>{timeInput}
            <span>{t("debtDialog.adjustValue")}</span>{amountInput}
            <span>{t("debtDialog.description")}</span>
            <div className="relative"><Pencil className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input aria-label={t("debtDialog.description")} className={cn(kvInput, "pl-8")} value={note} onChange={(e) => setNote(e.target.value)} /></div>
          </div>
        ) : (
          <div className={kvDialogBody}>
            <div className="grid grid-cols-1 gap-x-5 gap-y-3 md:grid-cols-2">
              <div className="grid gap-1.5"><Label className={kvLabel}>{t("debtDialog.time")}</Label>{timeInput}</div>
              <div className="grid gap-1.5"><Label className={kvLabel}>{kind === "payment" ? t("debtDialog.collector") : t("debtDialog.performer")}</Label>
                <select className={select} aria-label={kind === "payment" ? t("debtDialog.collector") : t("debtDialog.performer")} value={collectorId} onChange={(e) => setCollectorId(e.target.value)}>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                </select></div>
              {kind === "payment" && (
                <div className="grid gap-1.5"><Label className={kvLabel}>{t("debtDialog.method")}</Label>
                  <select className={select} aria-label={t("debtDialog.method")} value={method} onChange={(e) => setMethod(e.target.value)}>
                    {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{enumLabel(ts, salesNs, "enums.paymentMethod", m.value)}</option>)}
                  </select></div>
              )}
              <div className="grid gap-1.5 md:col-span-2">
                <Label className={kvLabel}>{kind === "payment" ? t("debtDialog.amount") : t("debtDialog.discountAmount")}</Label>{amountInput}
                <span className="text-right text-[12px] text-muted-foreground">{t(kind === "payment" ? "debtDialog.remainingAfterPayment" : "debtDialog.remainingAfterDiscount", { amount: formatMoney(remaining) })}</span>
              </div>
              <div className="grid gap-1.5 md:col-span-2"><Label className={kvLabel}>{t("debtDialog.note")}</Label>
                <Input placeholder={t("debtDialog.notePlaceholder")} aria-label={t("debtDialog.note")} className={kvInput} value={note} onChange={(e) => setNote(e.target.value)} /></div>
            </div>
            <label className="flex w-fit cursor-pointer items-center gap-2 py-1 text-[13px]">
              <Checkbox checked={allocate} onCheckedChange={(v) => setAllocate(v === true)} /> {t("debtDialog.allocate")}
            </label>
            {allocate && <CustomerDebtAllocationTable unpaid={unpaid} alloc={alloc} unallocated={Math.max(amount - allocated, 0)}
              onChange={(id, v) => setManual({ ...alloc, [id]: v })} />}
          </div>
        )}

        <DialogFooter className={kvDialogFooter}>
          <Button variant="outline" className={kvFooterBtn} onClick={onClose}>{tc("actions.skip")}</Button>
          {kind === "payment" && <Button variant="outline" className={kvFooterBtn} disabled={invalid} onClick={() => save.mutate(true)}
            title={tc("legal.vietnameseOnly")}>{t("debtDialog.createAndPrint")}</Button>}
          <Button className={kvFooterBtn} disabled={invalid} onClick={() => save.mutate(false)}>
            {kind === "adjust" ? tc("actions.update") : kind === "payment" ? t("debtDialog.createReceipt") : t("debtDialog.createVoucher")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
