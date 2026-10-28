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
import { useT } from "@/lib/i18n";
import { renderRichText } from "@/lib/i18n/render-rich-text";
import { useCurrentUser } from "@/lib/use-current-user";
import { commonNs } from "@/messages/common";
import { deliveryNs } from "@/messages/delivery";
import { salesNs } from "@/messages/sales";
import { refreshDelivery } from "./delivery-queries";
import type { DeliveryPartner, SettlementResult } from "./delivery-types";
import { FUND_OPTIONS } from "./reconcile-dialog";

const SELECT = `${kvInput} w-full border bg-background px-2`;

/**
 * Thanh toán với đối tác (không theo vận đơn): đối tác còn nợ → "Thu tiền đối tác" (phiếu thu);
 * cửa hàng còn nợ phí → "Trả tiền đối tác" (phiếu chi). Số tiền gợi ý = nợ hiện tại.
 */
export function PartnerPaymentDialog({ partner, onClose }: { partner: DeliveryPartner; onClose: () => void }) {
  const t = useT(deliveryNs);
  const tc = useT(commonNs);
  const ts = useT(salesNs);
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
    onSuccess: (r) => { toast.success(t("payment.created", { code: r.voucherCode ?? "", amount: formatMoney(amount) })); refreshDelivery(qc); onClose(); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={`${kvDialog} sm:max-w-[480px]`}>
        <DialogHeader className={kvDialogHeader}><DialogTitle className={kvDialogTitle}>{t("payment.title", { name: partner.name })}</DialogTitle></DialogHeader>
        <div className={kvDialogBody}>
          <p className="text-[13px]">{renderRichText(t(debt >= 0 ? "payment.partnerOwes" : "payment.shopOwes"),
            { amount: <b className="text-primary">{formatMoney(Math.abs(debt))}</b> })}</p>
          <div className="flex gap-5 text-[13px]">
            {([["RECEIPT", t("settlementKind.RECEIPT")], ["PAYMENT", t("settlementKind.PAYMENT")]] as const).map(([k, l]) => (
              <label key={k} className="flex items-center gap-1.5"><input type="radio" className="accent-primary" checked={direction === k}
                onChange={() => setDirection(k)} />{l}</label>))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1"><span className={kvLabel}>{t("fields.amount")}</span>
              <NumberInput aria-label={t("fields.amount")} className={kvInput} value={amount} onValueChange={setAmount} /></label>
            <label className="space-y-1"><span className={kvLabel}>{t("fields.fund")}</span>
              <select className={SELECT} value={fund} onChange={(e) => setFund(e.target.value)}>
                {FUND_OPTIONS.map((v) => <option key={v} value={v}>{ts(`enums.fund.${v}`)}</option>)}</select></label>
            <label className="col-span-2 space-y-1"><span className={kvLabel}>{tc("fields.branch")}</span>
              <select className={SELECT} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                {me?.user.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
          </div>
          <input className={`${kvInput} w-full border px-2`} placeholder={tc("fields.note")} aria-label={tc("fields.note")} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <DialogFooter className={kvDialogFooter}>
          <Button variant="outline" className={kvFooterBtn} onClick={onClose}>{tc("actions.skip")}</Button>
          <Button className={kvFooterBtn} disabled={save.isPending || amount <= 0} onClick={() => save.mutate()}>{t("payment.submit")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
