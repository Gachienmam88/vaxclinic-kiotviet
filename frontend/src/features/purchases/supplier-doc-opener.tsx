"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ReceiptViewDialog } from "./receipt-view-dialog";
import { ReturnDetailPanel } from "./return-detail-panel";
import { SupplierDebtDocDialog } from "./supplier-debt-doc-dialog";
import type { SupplierDebtType } from "./supplier-types";
import { useT } from "@/lib/i18n";
import { purchasesNs } from "@/messages/purchases";

export type OpenDoc = { type: SupplierDebtType; id: string };

/** Mở chứng từ khi bấm mã phiếu ở tab Lịch sử / Nợ cần trả: PN → phiếu nhập, THN → trả hàng nhập, còn lại → phiếu công nợ. */
export function SupplierDocOpener({ doc, supplierPhone, onClose }: { doc: OpenDoc | null; supplierPhone?: string | null; onClose: () => void }) {
  const t = useT(purchasesNs);
  if (!doc) return null;
  if (doc.type === "PURCHASE") return <ReceiptViewDialog id={doc.id} onClose={onClose} />;
  if (doc.type === "PURCHASE_RETURN") {
    return (
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-h-[92vh] gap-0 overflow-y-auto rounded-lg p-0 sm:max-w-[960px]">
          <DialogHeader className="px-5 pt-5 pb-3"><DialogTitle className="text-base font-bold">{t("detail.returnViewTitle")}</DialogTitle></DialogHeader>
          <ReturnDetailPanel id={doc.id} onClose={onClose} />
        </DialogContent>
      </Dialog>
    );
  }
  return <SupplierDebtDocDialog docId={doc.id} supplierPhone={supplierPhone} onClose={onClose} />;
}
