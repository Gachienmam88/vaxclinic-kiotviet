"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { kvDialog, kvDialogBody, kvDialogFooter, kvDialogHeader, kvDialogTitle, kvFooterBtn } from "@/features/sales/customer-ui-primitives";
import { SALES_KEYS } from "@/features/sales/sales-queries";
import { api, errorMessage } from "@/lib/api-client";
import { useT } from "@/lib/i18n";
import { ordersNs } from "@/messages/orders";

/** "Kết thúc": chuyển đơn sang Hoàn thành dù chưa giao hết (không tạo hóa đơn, không trừ kho; tiền cọc giữ nguyên). */
export function OrderFinishDialog({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const t = useT(ordersNs);
  const qc = useQueryClient();
  const finish = useMutation({
    mutationFn: () => api(`/orders/${orderId}/finish`, { method: "POST" }),
    onSuccess: () => { toast.success(t("kv.finishDlg.done")); SALES_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: k })); onClose(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={`${kvDialog} sm:max-w-[480px]`}>
        <DialogHeader className={kvDialogHeader}><DialogTitle className={kvDialogTitle}>{t("kv.finishDlg.title")}</DialogTitle></DialogHeader>
        <p className={`${kvDialogBody} text-[13px]`}>{t("kv.finishDlg.body")}</p>
        <DialogFooter className={kvDialogFooter}>
          <Button variant="outline" className={kvFooterBtn} onClick={onClose}>{t("kv.cancelDlg.skip")}</Button>
          <Button className={kvFooterBtn} disabled={finish.isPending} onClick={() => finish.mutate()}>{t("kv.cancelDlg.agree")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
