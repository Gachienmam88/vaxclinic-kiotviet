"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { kvDialog, kvDialogBody, kvDialogFooter, kvDialogHeader, kvDialogTitle, kvFooterBtn } from "@/features/sales/customer-ui-primitives";
import { RefundMethodFields, type RefundChoice } from "@/features/sales/refund-method-fields";
import { SALES_KEYS } from "@/features/sales/sales-queries";
import { api, errorMessage } from "@/lib/api-client";
import { formatMoney } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { renderRichText } from "@/lib/i18n/render-rich-text";
import { commonNs } from "@/messages/common";
import { ordersNs } from "@/messages/orders";
import type { Order } from "./order-types";

/**
 * Hủy đơn đặt hàng. Đơn có cọc: hoàn tiền (phiếu chi PC{mã đơn}, tiền mặt / chuyển khoản) hoặc giữ cọc làm công nợ
 * (không lập phiếu chi; phiếu thu cọc giữ nguyên, khách còn tiền trả trước dùng cho hóa đơn sau). Mặc định hoàn tiền mặt.
 */
export function OrderCancelDialog({ order, onClose }: { order: Order; onClose: () => void }) {
  const t = useT(ordersNs);
  const tc = useT(commonNs);
  const qc = useQueryClient();
  const deposit = Number(order.deposit);
  const [refund, setRefund] = useState<RefundChoice>({ method: "CASH", bankAccountId: "" });
  const cancel = useMutation({
    mutationFn: () => {
      const q = new URLSearchParams({ refundMethod: refund.method });
      if (refund.method === "TRANSFER" && refund.bankAccountId) q.set("bankAccountId", refund.bankAccountId);
      return api(`/orders/${order.id}/cancel?${q}`, { method: "POST" });
    },
    onSuccess: () => {
      toast.success(deposit <= 0 ? t("cancel.done") : refund.method === "CREDIT"
        ? t("cancel.doneCredit", { amount: formatMoney(deposit) })
        : t("cancel.doneRefund", { amount: formatMoney(deposit), voucher: `PC${order.code}` }));
      SALES_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: k }));
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={`${kvDialog} sm:max-w-[440px]`}>
        <DialogHeader className={kvDialogHeader}><DialogTitle className={kvDialogTitle}>{t("cancel.title", { code: order.code })}</DialogTitle></DialogHeader>
        <div className={`${kvDialogBody} text-[13px]`}>
          {deposit > 0 ? <>
            <p>{renderRichText(t("cancel.depositBody"), { amount: <b>{formatMoney(deposit)}</b> })}</p>
            <RefundMethodFields value={refund} onChange={setRefund} />
          </> : <p>{t("cancel.confirmBody")}</p>}
        </div>
        <DialogFooter className={kvDialogFooter}>
          <Button variant="outline" className={kvFooterBtn} onClick={onClose}>{tc("actions.skip")}</Button>
          <Button variant="destructive" className={kvFooterBtn} disabled={cancel.isPending} onClick={() => cancel.mutate()}>{t("cancel.submit")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
