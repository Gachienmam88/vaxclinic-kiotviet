"use client";

import { Fragment } from "react";
import { Star } from "lucide-react";
import { ListEmptyRow } from "@/components/ui/list-empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useT } from "@/lib/i18n";
import { formatMoney } from "@/lib/format";
import { salesNs } from "@/messages/sales";
import { cn } from "@/lib/utils";
import { InvoiceDetailPanel } from "./invoice-detail-panel";
import { invoiceCell, MONEY_COLUMNS, useCellContext } from "./invoice-list-cells";
import { LIST_HEAD_ROW } from "./invoice-list-kit";
import { INVOICE_COLUMNS, type InvoiceColumn } from "./invoice-list-prefs";
import type { InvoiceList } from "./sales-types";

const SUM_KEY = { subtotal: "sumSubtotal", discount: "sumDiscount", total: "sumTotal", paid: "sumPaid" } as const;
const WRAP: InvoiceColumn[] = ["customerName", "customerAddress", "note", "deliveryPartnerName"];

/**
 * Bảng danh sách Hóa đơn: ☆ (đánh dấu; bấm ☆ ở tiêu đề = chỉ xem hóa đơn đã đánh dấu), cột tùy chọn,
 * dòng tổng, mở chi tiết ngay dưới dòng.
 */
export function InvoiceListTable({ data, cols, expanded, onExpand, isFav, onToggleFav, favOnly, onFavOnly, onWiden }: {
  data: InvoiceList | undefined; cols: InvoiceColumn[]; expanded: string | null; onExpand: (id: string | null) => void;
  isFav: (id: string) => boolean; onToggleFav: (id: string) => void; favOnly: boolean; onFavOnly: () => void; onWiden?: () => void;
}) {
  const t = useT(salesNs);
  const visible = INVOICE_COLUMNS.map(([k]) => [k, t(`invoices.columns.${k}`)] as const).filter(([k]) => cols.includes(k));
  const span = visible.length + 2;
  const ctx = useCellContext(data?.items, cols);
  const right = (c: InvoiceColumn) => MONEY_COLUMNS.includes(c) && "text-right";
  const star = (on: boolean) => <Star className={cn("size-4", on ? "fill-[#ffb400] text-[#ffb400]" : "text-muted-foreground")} />;
  return (
    <Table stickyHeader>
      <TableHeader><TableRow className={LIST_HEAD_ROW}>
        <TableHead className="w-8 pl-4"><button type="button" onClick={onFavOnly} aria-pressed={favOnly}
          title={favOnly ? t("invoices.table.showAll") : t("invoices.table.favOnly")}>{star(favOnly)}</button></TableHead>
        <TableHead>{t("invoices.columns.code")}</TableHead>
        {visible.map(([k, l]) => <TableHead key={k} className={cn(right(k), "last:pr-4")}>{l}</TableHead>)}
      </TableRow></TableHeader>
      <TableBody>
        {!!data?.items.length && (
          <TableRow className="font-bold hover:bg-transparent">
            <TableCell colSpan={2} />
            {visible.map(([k]) => <TableCell key={k} className={cn(right(k), "last:pr-4")}>
              {k in SUM_KEY ? formatMoney(data[SUM_KEY[k as keyof typeof SUM_KEY]] ?? 0) : null}</TableCell>)}
          </TableRow>)}
        {data && !data.items.length && <ListEmptyRow cols={span} what={t("invoices.emptyWhat")} onWiden={onWiden} />}
        {data?.items.map((i) => (
          <Fragment key={i.id}>
            <TableRow className={cn("cursor-pointer", expanded === i.id && "bg-primary-tint hover:bg-primary-tint", i.state === "CANCELLED" && "text-muted-foreground")}
              onClick={() => onExpand(expanded === i.id ? null : i.id)}>
              <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
                <button type="button" aria-label={isFav(i.id) ? t("invoices.table.unmark") : t("invoices.table.mark")} onClick={() => onToggleFav(i.id)}>{star(isFav(i.id))}</button></TableCell>
              <TableCell>{i.code}</TableCell>
              {visible.map(([k]) => <TableCell key={k} className={cn(right(k), WRAP.includes(k) && "min-w-32 whitespace-normal", "last:pr-4")}>{invoiceCell(i, k, ctx)}</TableCell>)}
            </TableRow>
            {expanded === i.id && (
              <TableRow className="hover:bg-transparent"><TableCell colSpan={span} className="p-0 whitespace-normal">
                <InvoiceDetailPanel id={i.id} onClose={() => onExpand(null)} /></TableCell></TableRow>)}
          </Fragment>))}
      </TableBody>
    </Table>
  );
}
