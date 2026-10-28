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

type Kind = "payment" | "discount" | "adjust";
type Props = { kind: Kind; customer: Customer; onClose: () => void };

const TITLES: Record<Kind, string> = { payment: "Thanh toán", discount: "Chiết khấu thanh toán", adjust: "Điều chỉnh" };
const select = "h-8 w-full rounded-md border border-[#d9dbe0] bg-white px-2.5 text-[13px] outline-none focus:border-primary";

/** Hộp thoại Thanh toán / Chiết khấu thanh toán / Điều chỉnh công nợ của 1 khách hàng. */
export function DebtDialog({ kind, customer, onClose }: Props) {
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

  const save = useMutation({
    mutationFn: (_print: boolean) => {
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
      toast.success(`Đã tạo phiếu ${TITLES[kind].toLowerCase()}`);
      SALES_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: k }));
      if (print && res?.code) void printReceipt(res.code, branchId);
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const remaining = Number(customer.debt) - (kind === "adjust" ? 0 : amount);
  const invalid = save.isPending || (kind !== "adjust" && amount <= 0) || allocated > amount;
  const timeInput = <Input type="datetime-local" aria-label={kind === "adjust" ? "Ngày điều chỉnh" : "Thời gian"} className={kvInput}
    value={at} onChange={(e) => setAt(e.target.value)} />;
  const amountInput = <NumberInput autoFocus aria-label={kind === "adjust" ? "Giá trị nợ điều chỉnh" : kind === "payment" ? "Số tiền" : "Chiết khấu cho khách"}
    className={kvInput} value={amount} onValueChange={(v) => { setAmount(v); setManual(null); }} />;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={cn(kvDialog, kind === "adjust" ? "sm:max-w-[438px]" : "sm:max-w-[764px]")}>
        <DialogHeader className={cn(kvDialogHeader, "gap-1")}>
          <DialogTitle className={kvDialogTitle}>{TITLES[kind]}</DialogTitle>
          {kind !== "adjust" && <p className="flex items-center gap-1.5 text-[12px] text-foreground/70">
            {customer.name} <span>·</span> <KvChip>Nợ hiện tại: {formatMoney(customer.debt)}</KvChip></p>}
        </DialogHeader>

        {kind === "adjust" ? (
          <div className="grid grid-cols-[130px_1fr] items-center gap-x-2 gap-y-3 px-5 pt-3 pb-6 text-[13px]">
            <span>Nợ cần thu hiện tại</span><span>{formatMoney(customer.debt)}</span>
            <span>Ngày điều chỉnh</span>{timeInput}
            <span>Giá trị nợ điều chỉnh</span>{amountInput}
            <span>Mô tả</span>
            <div className="relative"><Pencil className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input aria-label="Mô tả" className={cn(kvInput, "pl-8")} value={note} onChange={(e) => setNote(e.target.value)} /></div>
          </div>
        ) : (
          <div className={kvDialogBody}>
            <div className="grid grid-cols-1 gap-x-5 gap-y-3 md:grid-cols-2">
              <div className="grid gap-1.5"><Label className={kvLabel}>Thời gian</Label>{timeInput}</div>
              <div className="grid gap-1.5"><Label className={kvLabel}>{kind === "payment" ? "Người thu" : "Người thực hiện"}</Label>
                <select className={select} aria-label={kind === "payment" ? "Người thu" : "Người thực hiện"} value={collectorId} onChange={(e) => setCollectorId(e.target.value)}>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                </select></div>
              {kind === "payment" && (
                <div className="grid gap-1.5"><Label className={kvLabel}>Phương thức thanh toán</Label>
                  <select className={select} aria-label="Phương thức thanh toán" value={method} onChange={(e) => setMethod(e.target.value)}>
                    {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select></div>
              )}
              <div className="grid gap-1.5 md:col-span-2">
                <Label className={kvLabel}>{kind === "payment" ? "Số tiền" : "Chiết khấu cho khách"}</Label>{amountInput}
                <span className="text-right text-[12px] text-muted-foreground">{kind === "payment" ? "Nợ còn" : "Nợ còn lại"}: {formatMoney(remaining)}</span>
              </div>
              <div className="grid gap-1.5 md:col-span-2"><Label className={kvLabel}>Ghi chú</Label>
                <Input placeholder="Nhập ghi chú" aria-label="Ghi chú" className={kvInput} value={note} onChange={(e) => setNote(e.target.value)} /></div>
            </div>
            <label className="flex w-fit cursor-pointer items-center gap-2 py-1 text-[13px]">
              <Checkbox checked={allocate} onCheckedChange={(v) => setAllocate(v === true)} /> Phân bổ vào hóa đơn
            </label>
            {allocate && <CustomerDebtAllocationTable unpaid={unpaid} alloc={alloc} unallocated={Math.max(amount - allocated, 0)}
              onChange={(id, v) => setManual({ ...alloc, [id]: v })} />}
          </div>
        )}

        <DialogFooter className={kvDialogFooter}>
          <Button variant="outline" className={kvFooterBtn} onClick={onClose}>Bỏ qua</Button>
          {kind === "payment" && <Button variant="outline" className={kvFooterBtn} disabled={invalid} onClick={() => save.mutate(true)}>Tạo phiếu thu &amp; In</Button>}
          <Button className={kvFooterBtn} disabled={invalid} onClick={() => save.mutate(false)}>
            {kind === "adjust" ? "Cập nhật" : kind === "payment" ? "Tạo phiếu thu" : "Tạo phiếu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
