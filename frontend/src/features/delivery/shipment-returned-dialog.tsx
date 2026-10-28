"use client";

import { useState } from "react";
import { NumberInput } from "@/components/number-input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { kvDialog, kvDialogBody, kvDialogFooter, kvDialogHeader, kvDialogTitle, kvFooterBtn, kvInput, kvLabel } from "@/features/sales/customer-ui-primitives";
import { RefundMethodFields, type RefundChoice } from "@/features/sales/refund-method-fields";
import { formatMoney } from "@/lib/format";
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
  const [refund, setRefund] = useState<RefundChoice>({ method: "CASH", bankAccountId: "" });
  const [fee, setFee] = useState(Number(single?.shippingFee ?? 0));
  const [returnFee, setReturnFee] = useState(0);
  const submit = () => onSubmit({ refundMethod: refund.method, bankAccountId: refund.method === "TRANSFER" ? refund.bankAccountId || null : null,
    ...(single ? { shippingFee: fee, returnFee } : {}) });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={`${kvDialog} sm:max-w-[480px]`}>
        <DialogHeader className={kvDialogHeader}>
          <DialogTitle className={kvDialogTitle}>Đã chuyển hoàn {single ? single.code : `${count} vận đơn`}</DialogTitle>
        </DialogHeader>
        <div className={kvDialogBody}>
          <p className="text-[13px] text-muted-foreground">Cửa hàng đã nhận lại hàng: hệ thống tạo phiếu trả hàng, hàng nhập lại kho.</p>
          <div className="space-y-1">
            <span className={kvLabel}>Tiền khách đã trả trước{single ? `: ${formatMoney(single.paid)}` : " (áp dụng cho tất cả vận đơn)"}</span>
            <RefundMethodFields value={refund} onChange={setRefund} allowCredit={!single?.walkIn} />
            {!single && <p className="text-xs text-muted-foreground">Khách lẻ không giữ làm công nợ được — vận đơn đó sẽ báo lỗi riêng.</p>}
          </div>
          {single ? (
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1"><span className={kvLabel}>Phí giao hàng cửa hàng chịu</span>
                <NumberInput aria-label="Phí giao hàng" className={kvInput} value={fee} onValueChange={setFee} /></label>
              <label className="block space-y-1"><span className={kvLabel}>Phí chuyển hoàn</span>
                <NumberInput aria-label="Phí chuyển hoàn" className={kvInput} value={returnFee} onValueChange={setReturnFee} /></label>
            </div>
          ) : <p className="text-xs text-muted-foreground">Phí cửa hàng chịu = phí giao hàng của từng vận đơn (cập nhật từng vận đơn để sửa phí).</p>}
        </div>
        <DialogFooter className={kvDialogFooter}>
          <Button variant="outline" className={kvFooterBtn} onClick={onClose}>Bỏ qua</Button>
          <Button className={kvFooterBtn} disabled={pending} onClick={submit}>Xác nhận</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
