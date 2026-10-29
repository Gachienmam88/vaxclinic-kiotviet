"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { kvDialog, kvDialogBody, kvDialogFooter, kvDialogHeader, kvDialogTitle, kvFooterBtn } from "@/features/sales/customer-ui-primitives";
import { useT } from "@/lib/i18n";
import { ordersNs } from "@/messages/orders";

/**
 * Hủy hóa đơn tạo từ đơn đặt hàng (KiotViet): "Hủy thanh toán — Bạn có muốn hủy những phiếu thanh toán liên quan?".
 * Bỏ qua = giữ phiếu thu cọc (đơn mở lại, cọc vẫn thuộc đơn); Xác nhận = hủy cả phiếu thu cọc của đơn.
 */
export function InvoiceCancelPaymentsDialog({ busy, onChoose, onClose }: {
  busy: boolean; onChoose: (cancelPayments: boolean) => void; onClose: () => void;
}) {
  const t = useT(ordersNs);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={`${kvDialog} sm:max-w-[440px]`}>
        <DialogHeader className={kvDialogHeader}><DialogTitle className={kvDialogTitle}>{t("kv.cancelPay.title")}</DialogTitle></DialogHeader>
        <p className={`${kvDialogBody} text-[13px]`}>{t("kv.cancelPay.body")}</p>
        <DialogFooter className={kvDialogFooter}>
          <Button variant="outline" className={kvFooterBtn} disabled={busy} onClick={() => onChoose(false)}>{t("kv.cancelDlg.skip")}</Button>
          <Button className={kvFooterBtn} disabled={busy} onClick={() => onChoose(true)}>{t("kv.cancelPay.confirm")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
