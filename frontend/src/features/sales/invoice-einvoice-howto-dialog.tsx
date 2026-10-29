"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { EInvoiceRecord } from "@/features/integrations/integration-queries";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { salesNs } from "@/messages/sales";
import { einvoiceLookupUrl } from "./invoice-einvoice-state";

/** Trang tra cứu chung của MISA meInvoice (không kèm mã). */
const LOOKUP_SITE = "https://www.meinvoice.vn/tra-cuu/";

/** "…" → "Cách tra cứu hóa đơn điện tử": trang tra cứu + mã tra cứu (transaction_id của bản ghi phát hành MISA). */
export function InvoiceEInvoiceHowToDialog({ rec, onClose }: { rec: EInvoiceRecord; onClose: () => void }) {
  const t = useT(salesNs);
  const tc = useT(commonNs);
  const url = einvoiceLookupUrl(rec);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-lg sm:max-w-[480px]">
        <DialogHeader><DialogTitle className="text-base font-bold">{t("invoices.einvoice.howToTitle")}</DialogTitle></DialogHeader>
        <div className="space-y-2.5 text-[13px]">
          <div className="grid grid-cols-[110px_1fr] gap-2"><span>{t("invoices.einvoice.howToSite")}</span>
            <a href={LOOKUP_SITE} target="_blank" rel="noreferrer" className="text-[#2171bc] hover:text-[#1a9dcc] hover:underline">{LOOKUP_SITE}</a></div>
          <div className="grid grid-cols-[110px_1fr] gap-2"><span>{t("invoices.einvoice.howToCode")}</span>
            {rec.transaction_id
              ? <a href={url!} target="_blank" rel="noreferrer" className="font-bold text-[#2171bc] hover:text-[#1a9dcc] hover:underline">{rec.transaction_id}</a>
              : <span className="text-muted-foreground">{t("invoices.einvoice.noLookupCode")}</span>}</div>
          <p className="text-muted-foreground">{t("invoices.einvoice.howToSteps")}</p>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>{tc("actions.close")}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
