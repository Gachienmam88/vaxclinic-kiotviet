"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { kvDialog, kvDialogBody, kvDialogFooter, kvDialogHeader, kvDialogTitle, kvFooterBtn } from "@/features/sales/customer-ui-primitives";
import { SALES_KEYS } from "@/features/sales/sales-queries";
import { api, errorMessage } from "@/lib/api-client";
import { useT } from "@/lib/i18n";
import { ordersNs } from "@/messages/orders";
import type { Order } from "./order-types";

/**
 * Hủy đơn đặt hàng (KiotViet, 2 bước): "Hủy phiếu đặt hàng" → Đồng ý; đơn có phiếu thu cọc còn hiệu lực hỏi tiếp
 * "Bạn có muốn hủy đặt cọc liên quan?": Đồng ý = hủy phiếu thu cọc (CANCEL_VOUCHERS, khách hết khoản trả trước);
 * Bỏ qua = giữ phiếu thu, tiền cọc thành tiền khách trả trước (CREDIT). Đơn đã có hóa đơn: báo lỗi, không hủy.
 */
export function OrderCancelDialog({ order, onClose }: { order: Order; onClose: () => void }) {
  const t = useT(ordersNs);
  const qc = useQueryClient();
  const hasReceipts = order.payments.some((p) => p.voucherType === "RECEIPT" && p.status === "PAID");
  const [step, setStep] = useState<"order" | "deposit">("order");
  const cancel = useMutation({
    mutationFn: (refundMethod: "CANCEL_VOUCHERS" | "CREDIT") =>
      api(`/orders/${order.id}/cancel?${new URLSearchParams({ refundMethod })}`, { method: "POST" }),
    onSuccess: () => {
      toast.success(t("kv.cancelDlg.done"));
      SALES_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: k }));
      onClose();
    },
    onError: (e) => { toast.error(errorMessage(e)); onClose(); },
  });
  const agree = () => {
    if (order.invoiceId) { toast.error(t("kv.cancelDlg.hasInvoice")); onClose(); return; }
    if (step === "order" && hasReceipts) setStep("deposit");
    else cancel.mutate(step === "deposit" ? "CANCEL_VOUCHERS" : "CREDIT");
  };
  const deposit = step === "deposit";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={`${kvDialog} sm:max-w-[440px]`}>
        <DialogHeader className={kvDialogHeader}><DialogTitle className={kvDialogTitle}>
          {t(deposit ? "kv.cancelDlg.depositTitle" : "kv.cancelDlg.title")}</DialogTitle></DialogHeader>
        <p className={`${kvDialogBody} text-[13px]`}>{deposit ? t("kv.cancelDlg.depositBody") : t("kv.cancelDlg.body", { code: order.code })}</p>
        <DialogFooter className={kvDialogFooter}>
          <Button variant="outline" className={kvFooterBtn} disabled={cancel.isPending}
            onClick={() => (deposit ? cancel.mutate("CREDIT") : onClose())}>{t("kv.cancelDlg.skip")}</Button>
          <Button className={kvFooterBtn} disabled={cancel.isPending} onClick={agree}>{t("kv.cancelDlg.agree")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
