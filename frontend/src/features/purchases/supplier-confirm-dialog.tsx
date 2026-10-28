"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { kvDialog, kvDialogFooter, kvDialogHeader, kvDialogTitle, kvFooterBtn } from "@/features/sales/customer-ui-primitives";
import { cn } from "@/lib/utils";

/** Popup "Xác nhận" kiểu KiotViet (Bỏ qua / Đồng ý) cho ngừng hoạt động, xóa NCC, hủy phiếu. */
export function SupplierConfirmDialog({ message, pending, onConfirm, onClose }: {
  message: string; pending?: boolean; onConfirm: () => void; onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={cn(kvDialog, "sm:max-w-[388px]")}>
        <DialogHeader className={kvDialogHeader}><DialogTitle className={kvDialogTitle}>Xác nhận</DialogTitle></DialogHeader>
        <p className="px-5 pb-4 text-[13px]">{message}</p>
        <DialogFooter className={kvDialogFooter}>
          <Button variant="outline" className={kvFooterBtn} onClick={onClose}>Bỏ qua</Button>
          <Button className={kvFooterBtn} disabled={pending} onClick={onConfirm}>Đồng ý</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
