"use client";

import { useState } from "react";
import Link from "next/link";
import { Copy, Ellipsis, FileOutput, Pencil, Save, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PrintButton } from "@/features/print/print-button";
import { invoiceData } from "@/features/print/print-data";
import type { EInvoiceRecord } from "@/features/integrations/integration-queries";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { commonNs } from "@/messages/common";
import { salesNs } from "@/messages/sales";
import { exportOneInvoice } from "./invoice-csv-export";
import { InvoiceEInvoiceHowToDialog } from "./invoice-einvoice-howto-dialog";
import { einvoiceLookupUrl } from "./invoice-einvoice-state";
import { DETAIL_BTN } from "./invoice-list-kit";
import type { Invoice } from "./sales-types";

/**
 * Chân chi tiết hóa đơn như KiotViet: trái Hủy · Sao chép · Xuất file; phải Chỉnh sửa · Lưu · Trả hàng · In · "…".
 * Sao chép = mở màn bán hàng với tab mới điền sẵn hàng / khách của hóa đơn (/sale?copy=<id>).
 * Hóa đơn đã phát hành HĐĐT (einvoice): như KiotViet ẩn Sao chép / Xuất file / In (bản chính thức là HĐĐT);
 * "…" có Xem hóa đơn điện tử (trang tra cứu MISA) và Cách tra cứu hóa đơn điện tử.
 */
export function InvoiceDetailFooter({ inv, active, canCancel, cancelling, onCancel, dirty, saving, onSave, einvoice, onEditTax }: {
  inv: Invoice; active: boolean; canCancel: boolean; cancelling: boolean; onCancel: () => void;
  dirty: boolean; saving: boolean; onSave: () => void; einvoice?: EInvoiceRecord; onEditTax: () => void;
}) {
  const t = useT(salesNs);
  const tc = useT(commonNs);
  const [howTo, setHowTo] = useState(false);
  const published = !!einvoice;
  const url = einvoice ? einvoiceLookupUrl(einvoice) : null;
  return (
    <div className="flex flex-wrap items-center gap-2 border-t px-4 py-2.5">
      {active && canCancel && (
        <Button variant="ghost" className={DETAIL_BTN} disabled={cancelling}
          onClick={() => confirm(t("invoices.footer.confirmCancel", { code: inv.code })) && onCancel()}>
          <Trash2 className="size-4" /> {t("invoices.footer.cancel")}</Button>)}
      {!published && <>
        <Button variant="ghost" className={DETAIL_BTN} render={<Link href={`/sale?copy=${inv.id}`} />}><Copy className="size-4" /> {t("invoices.footer.copy")}</Button>
        <Button variant="ghost" className={DETAIL_BTN} onClick={() => exportOneInvoice(inv)} title={t("invoices.toolbar.exportVietnameseNote")}><FileOutput className="size-4" /> {tc("actions.export")}</Button>
      </>}
      {active && <>
        <Button className={cn(DETAIL_BTN, "ml-auto")} render={<Link href={`/sale?edit=${inv.id}`} />}><Pencil className="size-4" /> {t("invoices.footer.edit")}</Button>
        <Button variant="outline" className={DETAIL_BTN} disabled={!dirty || saving} onClick={onSave}><Save className="size-4" /> {tc("actions.save")}</Button>
        <Button variant="outline" className={DETAIL_BTN} render={<Link href={`/sale?return=${inv.id}`} />}><Undo2 className="size-4" /> {t("invoices.footer.return")}</Button>
        {!published && <PrintButton type="INVOICE" data={invoiceData(inv)} branchId={inv.branchId} />}
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex size-[30px] items-center justify-center rounded-md border hover:bg-muted" aria-label={t("invoices.footer.more")}>
            <Ellipsis className="size-4" /></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {published && <>
              <DropdownMenuItem disabled={!url} onClick={() => url && window.open(url, "_blank", "noopener,noreferrer")}>
                {t("invoices.footer.viewEInvoice")}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setHowTo(true)}>{t("invoices.footer.einvoiceHowTo")}</DropdownMenuItem>
            </>}
            <DropdownMenuItem disabled={published} onClick={onEditTax}>
              {published ? t("invoices.footer.editTaxPublished", { label: t("invoices.footer.editTax") }) : t("invoices.footer.editTax")}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </>}
      {howTo && einvoice && <InvoiceEInvoiceHowToDialog rec={einvoice} onClose={() => setHowTo(false)} />}
    </div>
  );
}
