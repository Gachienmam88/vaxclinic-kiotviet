"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DOC_CODE_LINK_CLASS } from "@/components/ui/doc-code-link";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  kvDialog, kvDialogBody, kvDialogFooter, kvDialogHeader, kvDialogTitle, kvFooterBtn, kvInput, kvLabel, kvSubHead, kvSubRow, kvSubTable,
} from "@/features/sales/customer-ui-primitives";
import { StatusBadge } from "@/features/sales/invoice-list-kit";
import { api, errorMessage } from "@/lib/api-client";
import { formatDateTime, formatMoney } from "@/lib/format";
import { useCurrentUser } from "@/lib/use-current-user";
import { cn } from "@/lib/utils";
import { fromLocalInput, toLocalInput } from "./purchase-line-form";
import { useUserLookup } from "./purchase-queries";
import { ReceiptViewDialog } from "./receipt-view-dialog";
import { SupplierConfirmDialog } from "./supplier-confirm-dialog";
import { useSupplierPaymentPrinter } from "./supplier-payment-print";
import { useInvalidateSuppliers, useSupplierDoc } from "./supplier-queries";
import { SUPPLIER_PAYMENT_METHODS, type SupplierDebtDoc } from "./supplier-types";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { purchasesNs } from "@/messages/purchases";

const TITLE = {
  PAYMENT: "suppliers.doc.titlePayment", DISCOUNT: "suppliers.doc.titleDiscount", ADJUSTMENT: "suppliers.doc.titleAdjustment",
} as const;
const ro = cn(kvInput, "bg-[#eff0f3]");
const select = "h-8 w-full rounded-md border border-[#d9dbe0] bg-white px-2.5 text-[13px] outline-none focus:border-primary disabled:bg-[#eff0f3]";

/** Popup xem / sửa (thời gian, nhân viên, ghi chú) / hủy phiếu công nợ NCC — mở từ mã PCN…/PCPN…/CKN…/DCN… */
export function SupplierDebtDocDialog({ docId, supplierPhone, onClose }: { docId: string; supplierPhone?: string | null; onClose: () => void }) {
  const { data: d } = useSupplierDoc(docId);
  const tc = useT(commonNs);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={cn(kvDialog, "flex max-h-[92vh] flex-col sm:max-w-[857px]")}>
        {!d ? <div className="p-6 text-[13px] text-muted-foreground">{tc("status.loading")}</div>
          : <DocBody key={d.id + d.occurredAt + (d.note ?? "")} d={d} supplierPhone={supplierPhone} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function DocBody({ d, supplierPhone, onClose }: { d: SupplierDebtDoc; supplierPhone?: string | null; onClose: () => void }) {
  const invalidate = useInvalidateSuppliers();
  const print = useSupplierPaymentPrinter();
  const { can } = useCurrentUser();
  const { data: users = [] } = useUserLookup();
  const t = useT(purchasesNs);
  const tc = useT(commonNs);
  const [at, setAt] = useState(toLocalInput(d.occurredAt));
  const [staffId, setStaffId] = useState(d.staffId ?? "");
  const [note, setNote] = useState(d.note ?? "");
  const [confirm, setConfirm] = useState(false);
  const [viewReceipt, setViewReceipt] = useState<string | null>(null);
  const active = d.status === "ACTIVE" && can("inventory.manage");
  const done = (msg: string) => { toast.success(msg); invalidate(); onClose(); };
  const save = useMutation({
    mutationFn: () => api(`/suppliers/debt-docs/${d.id}`, { method: "PATCH", body: {
      occurredAt: fromLocalInput(at), staffId: staffId || null, staffName: users.find((u) => u.id === staffId)?.fullName, note } }),
    onSuccess: () => done(t("suppliers.doc.toastUpdated", { code: d.code })), onError: (e) => toast.error(errorMessage(e)),
  });
  const cancel = useMutation({
    mutationFn: () => api(`/suppliers/debt-docs/${d.id}/cancel`, { method: "POST" }),
    onSuccess: () => done(t("suppliers.doc.toastCancelled", { code: d.code })), onError: (e) => { setConfirm(false); toast.error(errorMessage(e)); },
  });
  const pay = d.kind === "PAYMENT";
  const label = pay
    ? { code: t("suppliers.doc.paymentCode"), staff: t("suppliers.doc.staff"), total: t("suppliers.doc.totalPaid"),
      paid: t("suppliers.doc.paidAmount"), before: t("suppliers.doc.paidBefore") }
    : { code: t("suppliers.history.docCode"), staff: t("suppliers.doc.performer"),
      total: d.kind === "DISCOUNT" ? t("suppliers.doc.discountValue") : t("suppliers.doc.adjustValue"),
      paid: t("suppliers.alloc.discountAlloc"), before: t("suppliers.alloc.paidBefore") };
  const methodKey = SUPPLIER_PAYMENT_METHODS.find(([v]) => v === d.paymentMethod)?.[1] ?? "payMethods.cash";
  return (
    <>
      <DialogHeader className={cn(kvDialogHeader, "gap-1")}>
        <DialogTitle className={kvDialogTitle}>{t(TITLE[d.kind])} {d.status === "CANCELLED" && <StatusBadge tone="red">{t("status.cancelled")}</StatusBadge>}</DialogTitle>
        <p className="text-[12px] text-primary">{d.supplierName}</p>
      </DialogHeader>
      <div className={cn(kvDialogBody, "overflow-y-auto")}>
        <div className="grid grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-2">
          <div className="grid gap-1.5"><Label className={kvLabel}>{label.code}</Label><Input readOnly className={ro} value={d.code} /></div>
          <div className="grid gap-1.5"><Label className={kvLabel}>{tc("fields.createdBy")}</Label><Input readOnly className={ro} value={d.createdByName} /></div>
          <div className="grid gap-1.5"><Label className={kvLabel}>{t("receipts.cols.time")}</Label>
            <DateTimePicker aria-label={t("receipts.cols.time")} disabled={!active} className={kvInput} value={at} onChange={(v) => setAt(v)} /></div>
          <div className="grid gap-1.5"><Label className={kvLabel}>{label.staff}</Label>
            <select className={select} aria-label={label.staff} disabled={!active} value={staffId} onChange={(e) => setStaffId(e.target.value)}>
              {!users.some((u) => u.id === staffId) && <option value={staffId}>{d.staffName}</option>}
              {users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
            </select></div>
          {pay && <div className="grid gap-1.5"><Label className={kvLabel}>{t("panel.paymentMethod")}</Label>
            <Input readOnly className={ro} value={t(methodKey)} /></div>}
          <div className="grid gap-1.5 md:col-span-2"><Label className={kvLabel}>{label.total}</Label>
            <Input readOnly className={cn(ro, "text-right font-bold")} value={formatMoney(d.amount)} /></div>
          <div className="grid gap-1.5 md:col-span-2"><Label className={kvLabel}>{tc("fields.note")}</Label>
            <Input placeholder={t("suppliers.doc.notePlaceholder")} aria-label={tc("fields.note")} disabled={!active} className={kvInput} value={note} onChange={(e) => setNote(e.target.value)} /></div>
        </div>
        {d.kind !== "ADJUSTMENT" && <>
          <label className="flex w-fit items-center gap-2 py-1 text-[13px] text-muted-foreground">
            <Checkbox checked={d.allocations.length > 0} disabled /> {t("suppliers.doc.allocated")}
          </label>
          {d.allocations.length > 0 && (
            <table className={kvSubTable}>
              <thead className={kvSubHead}><tr><th>{t("suppliers.history.docCode")}</th><th>{t("receipts.cols.time")}</th>
                <th className="text-right">{t("suppliers.doc.docValue")}</th>
                <th className="text-right">{label.before}</th><th className="text-right">{label.paid}</th><th className="text-right">{tc("fields.status")}</th></tr></thead>
              <tbody>
                <tr className={`${kvSubRow} font-bold`}><td colSpan={4} />
                  <td className="text-right">{formatMoney(d.allocations.reduce((s, a) => s + Number(a.amount), 0))}</td><td /></tr>
                {d.allocations.map((a) => (
                  <tr key={a.receiptId} className={kvSubRow}>
                    <td><button type="button" className={DOC_CODE_LINK_CLASS} onClick={() => setViewReceipt(a.receiptId)}>{a.code}</button></td>
                    <td>{formatDateTime(a.receivedAt)}</td><td className="text-right">{formatMoney(a.total)}</td>
                    <td className="text-right">{formatMoney(a.paidBefore)}</td><td className="text-right">{formatMoney(a.amount)}</td>
                    <td className="text-right"><StatusBadge tone={a.fullyPaid ? "green" : "blue"}>{a.fullyPaid ? t("suppliers.doc.fullyPaid") : t("suppliers.doc.partiallyPaid")}</StatusBadge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="flex justify-end gap-16 pr-2 text-[13px]"><span>{pay ? t("suppliers.alloc.unallocatedPay") : t("suppliers.alloc.unallocatedDiscount")}</span><b>{formatMoney(d.unallocated)}</b></div>
        </>}
      </div>
      <DialogFooter className={cn(kvDialogFooter, "sm:justify-between")}>
        {active ? <Button variant="ghost" className={cn(kvFooterBtn, "px-2")} onClick={() => setConfirm(true)}><Trash2 className="size-4" /> {tc("actions.cancel")}</Button> : <span />}
        <div className="flex gap-2">
          <Button variant="outline" className={kvFooterBtn} onClick={onClose}>{tc("actions.skip")}</Button>
          {pay && <Button variant="outline" className={kvFooterBtn} onClick={() => print(d, supplierPhone)}>{tc("actions.print")}</Button>}
          {active && <Button className={kvFooterBtn} disabled={save.isPending} onClick={() => save.mutate()}>{tc("actions.save")}</Button>}
        </div>
      </DialogFooter>
      {confirm && <SupplierConfirmDialog message={t(pay ? "suppliers.doc.confirmCancelPayment" : "suppliers.doc.confirmCancel", { code: d.code })}
        pending={cancel.isPending} onConfirm={() => cancel.mutate()} onClose={() => setConfirm(false)} />}
      {viewReceipt && <ReceiptViewDialog id={viewReceipt} onClose={() => setViewReceipt(null)} />}
    </>
  );
}
