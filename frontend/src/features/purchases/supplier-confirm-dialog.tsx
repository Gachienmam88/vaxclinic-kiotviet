"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { kvDialog, kvDialogFooter, kvDialogHeader, kvDialogTitle, kvFooterBtn } from "@/features/sales/customer-ui-primitives";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";

/** Popup "Xác nhận" kiểu KiotViet (Bỏ qua / Đồng ý) cho ngừng hoạt động, xóa NCC, hủy phiếu. */
export function SupplierConfirmDialog({ message, pending, onConfirm, onClose }: {
  message: string; pending?: boolean; onConfirm: () => void; onClose: () => void;
}) {
  const tc = useT(commonNs);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={cn(kvDialog, "sm:max-w-[520px]")}>
        <DialogHeader className={kvDialogHeader}><DialogTitle className={kvDialogTitle}>{tc("actions.confirm")}</DialogTitle></DialogHeader>
        <p className="px-5 pb-4 text-[13px]">{message}</p>
        <DialogFooter className={kvDialogFooter}>
          <Button variant="outline" className={kvFooterBtn} onClick={onClose}>{tc("actions.skip")}</Button>
          <Button className={kvFooterBtn} disabled={pending} onClick={onConfirm}>{tc("actions.agree")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
