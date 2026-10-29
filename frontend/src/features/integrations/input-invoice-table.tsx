"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { Eye, FilePlus2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DocCodeLink } from "@/components/ui/doc-code-link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ListEmptyRow } from "@/components/ui/list-empty-state";
import { DETAIL_PANEL, LIST_HEAD_ROW, StatusBadge, SUB_HEAD } from "@/features/sales/invoice-list-kit";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { NATURE_KEY, type InputInvoice } from "./integration-queries";
import { renderRichText } from "@/lib/i18n/render-rich-text";
import { useT } from "@/lib/i18n";
import { purchasesNs } from "@/messages/purchases";

const COLS = 8;

/** Bảng "Danh sách hóa đơn" đầu vào: dòng tổng, badge lập phiếu / tính chất, cột Thao tác, mở chi tiết dưới dòng. */
export function InputInvoiceTable({ items, sumTotal }: { items: InputInvoice[] | undefined; sumTotal: number }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const t = useT(purchasesNs);
  const toggle = (id: string) => setExpanded(expanded === id ? null : id);
  return (
    <div className="overflow-x-auto rounded-lg bg-background">
      <Table stickyHeader>
        <TableHeader><TableRow className={LIST_HEAD_ROW}>
          <TableHead className="pl-4">{t("inputInvoices.table.number")}</TableHead><TableHead>{t("inputInvoices.table.date")}</TableHead>
          <TableHead>{t("inputInvoices.filter.supplier")}</TableHead>
          <TableHead>{t("inputInvoices.filter.taxCode")}</TableHead><TableHead className="text-right">{t("inputInvoices.table.total")}</TableHead>
          <TableHead>{t("inputInvoices.filter.receiptStatus")}</TableHead><TableHead>{t("inputInvoices.table.nature")}</TableHead>
          <TableHead className="pr-4 text-right">{t("inputInvoices.table.actions")}</TableHead></TableRow></TableHeader>
        <TableBody>
          {!!items?.length && <TableRow className="font-bold hover:bg-transparent"><TableCell colSpan={4} />
            <TableCell className="text-right">{formatMoney(sumTotal)}</TableCell><TableCell colSpan={3} /></TableRow>}
          {items && !items.length && <ListEmptyRow cols={COLS} what={t("inputInvoices.unit")} />}
          {items?.map((i) => (
            <Fragment key={i.id}>
              <TableRow className={cn("cursor-pointer align-top", expanded === i.id && "bg-primary-tint hover:bg-primary-tint")} onClick={() => toggle(i.id)}>
                <TableCell className="pl-4">{i.number}</TableCell><TableCell>{formatDate(i.issuedAt)}</TableCell>
                <TableCell className="max-w-72 whitespace-normal">{i.sellerName} - {i.sellerTaxCode}</TableCell>
                <TableCell>{i.buyerTaxCode}</TableCell><TableCell className="text-right">{formatMoney(i.total)}</TableCell>
                <TableCell>{i.receiptId
                  ? <StatusBadge tone="green">{t("inputInvoices.filter.created")} <DocCodeLink code={i.receiptCode} /></StatusBadge>
                  : <StatusBadge tone="gray">{t("inputInvoices.filter.notCreated")}</StatusBadge>}</TableCell>
                <TableCell><StatusBadge tone="gray">{t(NATURE_KEY[i.nature])}</StatusBadge></TableCell>
                <TableCell className="pr-4" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-end gap-1.5">
                    {!i.receiptId && <Button size="sm" className="h-7 rounded-md" render={<Link href={`/purchases/receipts/new?fromInputInvoice=${i.id}`} />}>
                      <FilePlus2 className="size-3.5" /> {t("inputInvoices.table.createReceipt")}</Button>}
                    <button type="button" aria-label={t("inputInvoices.table.viewDetail", { number: i.number })} aria-expanded={expanded === i.id} onClick={() => toggle(i.id)}
                      className="inline-flex size-7 items-center justify-center rounded-md border bg-background hover:bg-muted"><Eye className="size-4" /></button>
                  </div>
                </TableCell>
              </TableRow>
              {expanded === i.id && (
                <TableRow className="hover:bg-transparent"><TableCell colSpan={COLS} className="p-0 whitespace-normal">
                  <div className={cn(DETAIL_PANEL, "space-y-3 p-4")}>
                    <p>{renderRichText(t("inputInvoices.table.detailSummary"), {
                      series: <b>{i.templateNo}{i.series}</b>, number: <b>{i.number}</b>, beforeTax: formatMoney(i.totalBeforeTax ?? 0),
                      vat: formatMoney(i.vatAmount ?? 0),
                      source: i.source === "XML" ? t("inputInvoices.table.sourceXml") : t("inputInvoices.table.sourcePortal") })}</p>
                    <table className="w-full"><thead className={SUB_HEAD}><tr><th className="pl-2.5">{t("lines.productName")}</th><th>{t("lines.unit")}</th>
                      <th className="text-right">{t("lines.quantity")}</th><th className="text-right">{t("lines.unitPrice")}</th>
                      <th>{t("inputInvoices.table.vatRate")}</th><th className="pr-2.5 text-right">{t("lines.amount")}</th></tr></thead>
                      <tbody>{i.lines.map((l, n) => (
                        <tr key={n} className="border-b border-[#eff0f3] [&_td]:px-2 [&_td]:py-2"><td>{l.name}</td><td>{l.unit}</td>
                          <td className="text-right">{formatNumber(l.quantity)}</td><td className="text-right">{formatNumber(l.unitPrice)}</td>
                          <td>{l.vatRate}</td><td className="text-right font-bold">{formatMoney(l.amount)}</td></tr>))}</tbody></table>
                  </div>
                </TableCell></TableRow>)}
            </Fragment>))}
        </TableBody>
      </Table>
    </div>
  );
}
