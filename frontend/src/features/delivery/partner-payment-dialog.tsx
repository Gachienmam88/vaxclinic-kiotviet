"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { NumberInput } from "@/components/number-input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { kvDialog, kvDialogBody, kvDialogFooter, kvDialogHeader, kvDialogTitle, kvFooterBtn, kvInput, kvLabel } from "@/features/sales/customer-ui-primitives";
import { api, errorMessage } from "@/lib/api-client";
import { formatMoney } from "@/lib/format";
import { useCurrentUser } from "@/lib/use-current-user";
import { refreshDelivery } from "./delivery-queries";
import type { DeliveryPartner, SettlementResult } from "./delivery-types";
import { FUNDS } from "./reconcile-dialog";

const SELECT = `${kvInput} w-full border bg-background px-2`;

/**
 * Thanh toán với đối tác (không theo vận đơn): đối tác còn nợ → "Thu tiền đối tác" (phiếu thu);
 * cửa hàng còn nợ phí → "Trả tiền đối tác" (phiếu chi). Số tiền gợi ý = nợ hiện tại.
 */
export function PartnerPaymentDialog({ partner, onClose }: { partner: DeliveryPartner; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: me } = useCurrentUser();
  const debt = Number(partner.debt);
  const [direction, setDirection] = useState<"RECEIPT" | "PAYMENT">(debt < 0 ? "PAYMENT" : "RECEIPT");
  const [amount, setAmount] = useState(Math.abs(debt));
  const [fund, setFund] = useState("CASH");
  const [branchId, setBranchId] = useState(me?.user.branches[0]?.id ?? "");
  const [note, setNote] = useState("");
  const save = useMutation({
    mutationFn: () => api<SettlementResult>(`/delivery-partners/${partner.id}/payments`, { method: "POST",
      body: { branchId: branchId || me?.user.branches[0]?.id, direction, amount, fund, note: note || null } }),
    onSuccess: (r) => { toast.success(`Đã lập phiếu ${r.voucherCode} ${formatMoney(amount)}`); refreshDelivery(qc); onClose(); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={`${kvDialog} sm:max-w-[480px]`}>
        <DialogHeader className={kvDialogHeader}><DialogTitle className={kvDialogTitle}>Thanh toán — {partner.name}</DialogTitle></DialogHeader>
        <div className={kvDialogBody}>
          <p className="text-[13px]">{debt >= 0 ? "Đối tác đang nợ cửa hàng" : "Cửa hàng đang nợ đối tác"}: <b className="text-primary">{formatMoney(Math.abs(debt))}</b></p>
          <div className="flex gap-5 text-[13px]">
            {([["RECEIPT", "Thu tiền đối tác"], ["PAYMENT", "Trả tiền đối tác"]] as const).map(([k, l]) => (
              <label key={k} className="flex items-center gap-1.5"><input type="radio" className="accent-primary" checked={direction === k}
                onChange={() => setDirection(k)} />{l}</label>))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1"><span className={kvLabel}>Số tiền</span>
              <NumberInput aria-label="Số tiền" className={kvInput} value={amount} onValueChange={setAmount} /></label>
            <label className="space-y-1"><span className={kvLabel}>Quỹ</span>
              <select className={SELECT} value={fund} onChange={(e) => setFund(e.target.value)}>
                {FUNDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
            <label className="col-span-2 space-y-1"><span className={kvLabel}>Chi nhánh</span>
              <select className={SELECT} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                {me?.user.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
          </div>
          <input className={`${kvInput} w-full border px-2`} placeholder="Ghi chú" aria-label="Ghi chú" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <DialogFooter className={kvDialogFooter}>
          <Button variant="outline" className={kvFooterBtn} onClick={onClose}>Bỏ qua</Button>
          <Button className={kvFooterBtn} disabled={save.isPending || amount <= 0} onClick={() => save.mutate()}>Tạo phiếu</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
