"use client";

import { useMemo } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { printHtml, sanitizeHtml } from "@/features/print/print-render";
import { kvDialog, kvDialogFooter, kvDialogHeader, kvDialogTitle, kvFooterBtn } from "@/features/sales/customer-ui-primitives";
import { cn } from "@/lib/utils";
import { useInputInvoice } from "./integration-queries";
import { buildInvoiceDocument } from "./input-invoice-document";
import { useT } from "@/lib/i18n";
import { inputInvoicesNs } from "@/messages/input-invoices";

/** 👁 "Chi tiết hóa đơn điện tử": hóa đơn GTGT dựng từ dữ liệu XML / cổng thuế; In qua đường in chung (sanitizeHtml). */
export function InputInvoiceDetailDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const t = useT(inputInvoicesNs);
  const { data: inv } = useInputInvoice(id);
  const html = useMemo(() => (inv ? buildInvoiceDocument(inv) : ""), [inv]);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={cn(kvDialog, "flex max-h-[92vh] flex-col sm:max-w-[720px]")}>
        <DialogHeader className={kvDialogHeader}><DialogTitle className={kvDialogTitle}>{t("detail.title")}</DialogTitle></DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
          {inv
            ? <div className="rounded border border-[#e5e7eb] bg-white p-4" dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }} />
            : <div className="py-10 text-center text-[13px] text-muted-foreground">{t("common.loading")}</div>}
        </div>
        <DialogFooter className={kvDialogFooter}>
          <Button variant="outline" className={kvFooterBtn} onClick={onClose}>{t("detail.close")}</Button>
          <Button className={kvFooterBtn} disabled={!inv} onClick={() => printHtml(html)}><Printer className="size-4" /> {t("detail.print")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
