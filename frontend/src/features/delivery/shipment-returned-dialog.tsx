"use client";

import { useState } from "react";
import { NumberInput } from "@/components/number-input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { kvDialog, kvDialogBody, kvDialogFooter, kvDialogHeader, kvDialogTitle, kvFooterBtn, kvInput, kvLabel } from "@/features/sales/customer-ui-primitives";
import { RefundMethodFields, type RefundChoice } from "@/features/sales/refund-method-fields";
import { formatMoney } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { deliveryNs } from "@/messages/delivery";
import type { ReturnedOptions } from "./use-shipment-status";

/**
 * "Đã chuyển hoàn" (cửa hàng đã nhận lại hàng → phiếu trả hàng, hàng về kho): chọn cách hoàn tiền khách đã trả trước
 * + phí cửa hàng chịu (phí giao hàng mặc định = phí vận đơn, phí chuyển hoàn tùy chọn) ghi vào công nợ đối tác.
 * Cập nhật hàng loạt (single = undefined): chỉ chọn cách hoàn tiền, phí lấy mặc định của từng vận đơn.
 */
export function ShipmentReturnedDialog({ count, single, pending, onSubmit, onClose }: {
  count: number; pending: boolean; onClose: () => void; onSubmit: (o: ReturnedOptions) => void;
  single?: { code: string; shippingFee: number; paid: number; walkIn: boolean };
}) {
  const t = useT(deliveryNs);
  const tc = useT(commonNs);
  const [refund, setRefund] = useState<RefundChoice>({ method: "CASH", bankAccountId: "" });
  const [fee, setFee] = useState(Number(single?.shippingFee ?? 0));
  const [returnFee, setReturnFee] = useState(0);
  const submit = () => onSubmit({ refundMethod: refund.method, bankAccountId: refund.method === "TRANSFER" ? refund.bankAccountId || null : null,
    ...(single ? { shippingFee: fee, returnFee } : {}) });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={`${kvDialog} sm:max-w-[480px]`}>
        <DialogHeader className={kvDialogHeader}>
          <DialogTitle className={kvDialogTitle}>{single ? t("returned.titleOne", { code: single.code }) : t("returned.titleMany", { count })}</DialogTitle>
        </DialogHeader>
        <div className={kvDialogBody}>
          <p className="text-[13px] text-muted-foreground">{t("returned.intro")}</p>
          <div className="space-y-1">
            <span className={kvLabel}>{single ? t("returned.prepaidOne", { amount: formatMoney(single.paid) }) : t("returned.prepaidMany")}</span>
            <RefundMethodFields value={refund} onChange={setRefund} allowCredit={!single?.walkIn} />
            {!single && <p className="text-xs text-muted-foreground">{t("returned.walkInNote")}</p>}
          </div>
          {single ? (
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1"><span className={kvLabel}>{t("returned.shopFee")}</span>
                <NumberInput aria-label={t("fields.fee")} className={kvInput} value={fee} onValueChange={setFee} /></label>
              <label className="block space-y-1"><span className={kvLabel}>{t("returned.returnFee")}</span>
                <NumberInput aria-label={t("returned.returnFee")} className={kvInput} value={returnFee} onValueChange={setReturnFee} /></label>
            </div>
          ) : <p className="text-xs text-muted-foreground">{t("returned.bulkFeeNote")}</p>}
        </div>
        <DialogFooter className={kvDialogFooter}>
          <Button variant="outline" className={kvFooterBtn} onClick={onClose}>{tc("actions.skip")}</Button>
          <Button className={kvFooterBtn} disabled={pending} onClick={submit}>{tc("actions.confirm")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
