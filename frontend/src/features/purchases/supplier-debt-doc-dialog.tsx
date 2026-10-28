"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

const TITLE = { PAYMENT: "Phiếu chi", DISCOUNT: "Chiết khấu thanh toán", ADJUSTMENT: "Điều chỉnh công nợ" } as const;
const ro = cn(kvInput, "bg-[#eff0f3]");
const select = "h-8 w-full rounded-md border border-[#d9dbe0] bg-white px-2.5 text-[13px] outline-none focus:border-primary disabled:bg-[#eff0f3]";

/** Popup xem / sửa (thời gian, nhân viên, ghi chú) / hủy phiếu công nợ NCC — mở từ mã PCN…/PCPN…/CKN…/DCN… */
export function SupplierDebtDocDialog({ docId, supplierPhone, onClose }: { docId: string; supplierPhone?: string | null; onClose: () => void }) {
  const { data: d } = useSupplierDoc(docId);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={cn(kvDialog, "flex max-h-[92vh] flex-col sm:max-w-[640px]")}>
        {!d ? <div className="p-6 text-[13px] text-muted-foreground">Đang tải...</div>
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
    onSuccess: () => done(`Đã cập nhật ${d.code}`), onError: (e) => toast.error(errorMessage(e)),
  });
  const cancel = useMutation({
    mutationFn: () => api(`/suppliers/debt-docs/${d.id}/cancel`, { method: "POST" }),
    onSuccess: () => done(`Đã hủy ${d.code}`), onError: (e) => { setConfirm(false); toast.error(errorMessage(e)); },
  });
  const pay = d.kind === "PAYMENT";
  const label = pay ? { code: "Mã phiếu chi", staff: "Nhân viên", total: "Tổng tiền chi", paid: "Tiền chi", before: "Đã chi trước" }
    : { code: "Mã phiếu", staff: "Người thực hiện", total: d.kind === "DISCOUNT" ? "Chiết khấu" : "Giá trị điều chỉnh", paid: "Chiết khấu phân bổ", before: "Đã trả trước" };
  return (
    <>
      <DialogHeader className={cn(kvDialogHeader, "gap-1")}>
        <DialogTitle className={kvDialogTitle}>{TITLE[d.kind]} {d.status === "CANCELLED" && <StatusBadge tone="red">Đã hủy</StatusBadge>}</DialogTitle>
        <p className="text-[12px] text-primary">{d.supplierName}</p>
      </DialogHeader>
      <div className={cn(kvDialogBody, "overflow-y-auto")}>
        <div className="grid grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-2">
          <div className="grid gap-1.5"><Label className={kvLabel}>{label.code}</Label><Input readOnly className={ro} value={d.code} /></div>
          <div className="grid gap-1.5"><Label className={kvLabel}>Người tạo</Label><Input readOnly className={ro} value={d.createdByName} /></div>
          <div className="grid gap-1.5"><Label className={kvLabel}>Thời gian</Label>
            <Input type="datetime-local" aria-label="Thời gian" disabled={!active} className={kvInput} value={at} onChange={(e) => setAt(e.target.value)} /></div>
          <div className="grid gap-1.5"><Label className={kvLabel}>{label.staff}</Label>
            <select className={select} aria-label={label.staff} disabled={!active} value={staffId} onChange={(e) => setStaffId(e.target.value)}>
              {!users.some((u) => u.id === staffId) && <option value={staffId}>{d.staffName}</option>}
              {users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
            </select></div>
          {pay && <div className="grid gap-1.5"><Label className={kvLabel}>Phương thức thanh toán</Label>
            <Input readOnly className={ro} value={SUPPLIER_PAYMENT_METHODS.find(([v]) => v === d.paymentMethod)?.[1] ?? "Tiền mặt"} /></div>}
          <div className="grid gap-1.5 md:col-span-2"><Label className={kvLabel}>{label.total}</Label>
            <Input readOnly className={cn(ro, "text-right font-bold")} value={formatMoney(d.amount)} /></div>
          <div className="grid gap-1.5 md:col-span-2"><Label className={kvLabel}>Ghi chú</Label>
            <Input placeholder="Nhập ghi chú" aria-label="Ghi chú" disabled={!active} className={kvInput} value={note} onChange={(e) => setNote(e.target.value)} /></div>
        </div>
        {d.kind !== "ADJUSTMENT" && <>
          <label className="flex w-fit items-center gap-2 py-1 text-[13px] text-muted-foreground">
            <Checkbox checked={d.allocations.length > 0} disabled /> Phân bổ vào phiếu nhập hàng
          </label>
          {d.allocations.length > 0 && (
            <table className={kvSubTable}>
              <thead className={kvSubHead}><tr><th>Mã phiếu</th><th>Thời gian</th><th className="text-right">Giá trị phiếu</th>
                <th className="text-right">{label.before}</th><th className="text-right">{label.paid}</th><th className="text-right">Trạng thái</th></tr></thead>
              <tbody>
                <tr className={`${kvSubRow} font-bold`}><td colSpan={4} />
                  <td className="text-right">{formatMoney(d.allocations.reduce((s, a) => s + Number(a.amount), 0))}</td><td /></tr>
                {d.allocations.map((a) => (
                  <tr key={a.receiptId} className={kvSubRow}>
                    <td><button type="button" className="text-primary hover:underline" onClick={() => setViewReceipt(a.receiptId)}>{a.code}</button></td>
                    <td>{formatDateTime(a.receivedAt)}</td><td className="text-right">{formatMoney(a.total)}</td>
                    <td className="text-right">{formatMoney(a.paidBefore)}</td><td className="text-right">{formatMoney(a.amount)}</td>
                    <td className="text-right"><StatusBadge tone={a.fullyPaid ? "green" : "orange"}>{a.fullyPaid ? "Đã thanh toán" : "Thanh toán một phần"}</StatusBadge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="flex justify-end gap-16 pr-2 text-[13px]"><span>{pay ? "Tiền chưa phân bổ:" : "Chiết khấu chưa phân bổ:"}</span><b>{formatMoney(d.unallocated)}</b></div>
        </>}
      </div>
      <DialogFooter className={cn(kvDialogFooter, "sm:justify-between")}>
        {active ? <Button variant="ghost" className={cn(kvFooterBtn, "px-2")} onClick={() => setConfirm(true)}><Trash2 className="size-4" /> Hủy</Button> : <span />}
        <div className="flex gap-2">
          <Button variant="outline" className={kvFooterBtn} onClick={onClose}>Bỏ qua</Button>
          {pay && <Button variant="outline" className={kvFooterBtn} onClick={() => print(d, supplierPhone)}>In</Button>}
          {active && <Button className={kvFooterBtn} disabled={save.isPending} onClick={() => save.mutate()}>Lưu</Button>}
        </div>
      </DialogFooter>
      {confirm && <SupplierConfirmDialog message={`Bạn có chắc chắn muốn hủy phiếu ${d.code}? ${pay ? "Phiếu chi tương ứng trong Sổ quỹ cũng bị hủy." : ""}`}
        pending={cancel.isPending} onConfirm={() => cancel.mutate()} onClose={() => setConfirm(false)} />}
      {viewReceipt && <ReceiptViewDialog id={viewReceipt} onClose={() => setViewReceipt(null)} />}
    </>
  );
}
