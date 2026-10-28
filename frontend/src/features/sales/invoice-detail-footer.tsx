"use client";

import Link from "next/link";
import { Copy, Ellipsis, FileOutput, Pencil, Save, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PrintButton } from "@/features/print/print-button";
import { invoiceData } from "@/features/print/print-data";
import { cn } from "@/lib/utils";
import { exportOneInvoice } from "./invoice-csv-export";
import { DETAIL_BTN } from "./invoice-list-kit";
import type { Invoice } from "./sales-types";

/**
 * Chân chi tiết hóa đơn như KiotViet: trái Hủy · Sao chép · Xuất file; phải Chỉnh sửa · Lưu · Trả hàng · In · "…".
 * Sao chép = mở màn bán hàng với tab mới điền sẵn hàng / khách của hóa đơn (/pos?copy=<id>).
 */
export function InvoiceDetailFooter({ inv, active, canCancel, cancelling, onCancel, dirty, saving, onSave, published, onEditTax }: {
  inv: Invoice; active: boolean; canCancel: boolean; cancelling: boolean; onCancel: () => void;
  dirty: boolean; saving: boolean; onSave: () => void; published: boolean; onEditTax: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-t px-4 py-2.5">
      {active && canCancel && (
        <Button variant="ghost" className={DETAIL_BTN} disabled={cancelling}
          onClick={() => confirm(`Hủy hóa đơn ${inv.code}? Hàng sẽ được hoàn lại kho.`) && onCancel()}>
          <Trash2 className="size-4" /> Hủy</Button>)}
      <Button variant="ghost" className={DETAIL_BTN} render={<Link href={`/pos?copy=${inv.id}`} />}><Copy className="size-4" /> Sao chép</Button>
      <Button variant="ghost" className={DETAIL_BTN} onClick={() => exportOneInvoice(inv)}><FileOutput className="size-4" /> Xuất file</Button>
      {active && <>
        <Button className={cn(DETAIL_BTN, "ml-auto")} render={<Link href={`/pos?edit=${inv.id}`} />}><Pencil className="size-4" /> Chỉnh sửa</Button>
        <Button variant="outline" className={DETAIL_BTN} disabled={!dirty || saving} onClick={onSave}><Save className="size-4" /> Lưu</Button>
        <Button variant="outline" className={DETAIL_BTN} render={<Link href={`/pos?return=${inv.id}`} />}><Undo2 className="size-4" /> Trả hàng</Button>
        <PrintButton type="INVOICE" data={invoiceData(inv)} branchId={inv.branchId} />
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex size-[30px] items-center justify-center rounded-md border hover:bg-muted" aria-label="Thêm thao tác">
            <Ellipsis className="size-4" /></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled={published} onClick={onEditTax}>
              Sửa tỷ lệ thuế hàng hóa{published && " (đã phát hành HĐĐT)"}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </>}
    </div>
  );
}
