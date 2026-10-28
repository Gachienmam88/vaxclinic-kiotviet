"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/number-input";
import { NativeSelect } from "@/features/products/product-form-sections";
import { fromLocalInput, toLocalInput } from "@/features/purchases/purchase-line-form";
import { useUserLookup } from "@/features/purchases/purchase-queries";
import { api, errorMessage } from "@/lib/api-client";
import { formatDateTime, formatMoney } from "@/lib/format";
import { useCurrentUser } from "@/lib/use-current-user";
import { SALES_KEYS } from "./sales-queries";
import { PAYMENT_METHODS, type Customer, type InvoiceList } from "./sales-types";

type Kind = "payment" | "discount" | "adjust";
type Props = { kind: Kind; customer: Customer; onClose: () => void };

const TITLES: Record<Kind, string> = { payment: "Thanh toán", discount: "Chiết khấu thanh toán", adjust: "Điều chỉnh" };

/** Hộp thoại Thanh toán / Chiết khấu thanh toán / Điều chỉnh công nợ của 1 khách hàng. */
export function DebtDialog({ kind, customer, onClose }: Props) {
  const qc = useQueryClient();
  const { data: me } = useCurrentUser();
  const { data: users = [] } = useUserLookup();
  const [at, setAt] = useState(toLocalInput(new Date().toISOString()));
  const [collectorId, setCollectorId] = useState(me?.user.id ?? "");
  const [method, setMethod] = useState("CASH");
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState("");
  const [allocate, setAllocate] = useState(kind === "payment");
  const [manual, setManual] = useState<Record<string, number> | null>(null);

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
    mutationFn: () => {
      if (kind === "adjust") {
        return api(`/customers/${customer.id}/adjustments`, { method: "POST", body: { occurredAt: fromLocalInput(at), newDebt: amount, note } });
      }
      return api(`/customers/${customer.id}/${kind === "payment" ? "payments" : "discounts"}`, { method: "POST", body: {
        branchId: me?.user.branches[0]?.id, occurredAt: fromLocalInput(at), collectorId: collectorId || null,
        collectorName: users.find((u) => u.id === collectorId)?.fullName, paymentMethod: method, amount, note, allocate,
        allocations: allocate ? Object.entries(alloc).filter(([, v]) => v > 0).map(([invoiceId, v]) => ({ invoiceId, amount: v })) : null,
      } });
    },
    onSuccess: () => {
      toast.success(`Đã tạo phiếu ${TITLES[kind].toLowerCase()}`);
      SALES_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: k }));
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const remaining = Number(customer.debt) - (kind === "adjust" ? 0 : amount);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={kind === "adjust" ? "sm:max-w-md" : "sm:max-w-3xl"}>
        <DialogHeader>
          <DialogTitle>{TITLES[kind]}</DialogTitle>
          <p className="text-sm text-muted-foreground">{customer.name} · Nợ hiện tại: {formatMoney(customer.debt)}</p>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="grid gap-1.5"><Label>{kind === "adjust" ? "Ngày điều chỉnh" : "Thời gian"}</Label>
            <Input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} /></div>
          {kind !== "adjust" && (
            <div className="grid gap-1.5"><Label>{kind === "payment" ? "Người thu" : "Người thực hiện"}</Label>
              <NativeSelect value={collectorId} onChange={(e) => setCollectorId(e.target.value)}>
                {users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
              </NativeSelect></div>
          )}
          {kind === "payment" && (
            <div className="grid gap-1.5"><Label>Phương thức thanh toán</Label>
              <NativeSelect value={method} onChange={(e) => setMethod(e.target.value)}>
                {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </NativeSelect></div>
          )}
          <div className="grid gap-1.5 md:col-span-2">
            <Label>{kind === "adjust" ? "Giá trị nợ điều chỉnh" : kind === "payment" ? "Số tiền" : "Chiết khấu cho khách"}</Label>
            <NumberInput autoFocus value={amount} onValueChange={(v) => { setAmount(v); setManual(null); }} />
            {kind !== "adjust" && <span className="text-right text-xs text-muted-foreground">Nợ còn: {formatMoney(remaining)}</span>}
          </div>
          <div className="grid gap-1.5 md:col-span-2"><Label>{kind === "adjust" ? "Mô tả" : "Ghi chú"}</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} /></div>
        </div>
        {kind !== "adjust" && (
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={allocate} onCheckedChange={(v) => setAllocate(v === true)} /> Phân bổ vào hóa đơn
            </label>
            {allocate && (
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-left"><tr>
                  <th className="px-2 py-1.5">Mã hóa đơn</th><th className="px-2">Thời gian</th><th className="px-2 text-right">Giá trị hóa đơn</th>
                  <th className="px-2 text-right">Đã thu trước</th><th className="px-2 text-right">Còn cần thu</th><th className="w-36 px-2 text-right">Tiền thu</th>
                </tr></thead>
                <tbody>
                  {!unpaid?.length && <tr><td colSpan={6} className="py-4 text-center text-muted-foreground">Không có hóa đơn còn nợ</td></tr>}
                  {unpaid?.map((i) => (
                    <tr key={i.id} className="border-b">
                      <td className="px-2 py-1.5 text-primary">{i.code}</td><td className="px-2">{formatDateTime(i.soldAt)}</td>
                      <td className="px-2 text-right">{formatMoney(i.total)}</td><td className="px-2 text-right">{formatMoney(i.paid)}</td>
                      <td className="px-2 text-right">{formatMoney(i.total - i.paid)}</td>
                      <td className="px-2"><NumberInput className="h-7" value={alloc[i.id] ?? 0}
                        onValueChange={(v) => setManual({ ...alloc, [i.id]: Math.min(v, i.total - i.paid) })} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {allocate && <p className="text-right text-sm">Tiền chưa phân bổ: <b>{formatMoney(Math.max(amount - allocated, 0))}</b></p>}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Bỏ qua</Button>
          <Button disabled={save.isPending || (kind !== "adjust" && amount <= 0) || allocated > amount} onClick={() => save.mutate()}>
            {kind === "adjust" ? "Cập nhật" : kind === "payment" ? "Tạo phiếu thu" : "Tạo phiếu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
