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
import type { Order } from "./order-types";

/**
 * Hủy đơn đặt hàng. Đơn có cọc: hoàn tiền (phiếu chi PC{mã đơn}, tiền mặt / chuyển khoản) hoặc giữ cọc làm công nợ
 * (không lập phiếu chi; phiếu thu cọc giữ nguyên, khách còn tiền trả trước dùng cho hóa đơn sau). Mặc định hoàn tiền mặt.
 */
export function OrderCancelDialog({ order, onClose }: { order: Order; onClose: () => void }) {
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
      toast.success(deposit <= 0 ? "Đã hủy đơn đặt hàng" : refund.method === "CREDIT"
        ? `Đã hủy đơn, giữ ${formatMoney(deposit)} làm tiền khách trả trước` : `Đã hủy đơn, hoàn ${formatMoney(deposit)} cho khách (phiếu chi PC${order.code})`);
      SALES_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: k }));
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={`${kvDialog} sm:max-w-[440px]`}>
        <DialogHeader className={kvDialogHeader}><DialogTitle className={kvDialogTitle}>Hủy đơn {order.code}</DialogTitle></DialogHeader>
        <div className={`${kvDialogBody} text-[13px]`}>
          {deposit > 0 ? <>
            <p>Khách đã đặt cọc <b>{formatMoney(deposit)}</b>. Xử lý tiền cọc:</p>
            <RefundMethodFields value={refund} onChange={setRefund} />
          </> : <p>Bạn có chắc muốn hủy đơn đặt hàng này?</p>}
        </div>
        <DialogFooter className={kvDialogFooter}>
          <Button variant="outline" className={kvFooterBtn} onClick={onClose}>Bỏ qua</Button>
          <Button variant="destructive" className={kvFooterBtn} disabled={cancel.isPending} onClick={() => cancel.mutate()}>Hủy đơn</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
