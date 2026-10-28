"use client";

import { Fragment } from "react";
import { Star } from "lucide-react";
import { DocCodeLink } from "@/components/ui/doc-code-link";
import { ListEmptyRow } from "@/components/ui/list-empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useT, type TFunction } from "@/lib/i18n";
import { formatDateTime, formatMoney } from "@/lib/format";
import { salesNs } from "@/messages/sales";
import { cn } from "@/lib/utils";
import { InvoiceDetailPanel } from "./invoice-detail-panel";
import { enumLabel } from "./i18n-enum-label";
import { STATE_TONE } from "./invoice-filter-model";
import { LIST_HEAD_ROW, StatusBadge } from "./invoice-list-kit";
import { INVOICE_COLUMNS, type InvoiceColumn } from "./invoice-list-prefs";
import type { InvoiceList, InvoiceListItem } from "./sales-types";

const MONEY: InvoiceColumn[] = ["subtotal", "discount", "total", "paid"];
const SUM_KEY = { subtotal: "sumSubtotal", discount: "sumDiscount", total: "sumTotal", paid: "sumPaid" } as const;

function cell(i: InvoiceListItem, c: InvoiceColumn, t: TFunction<typeof salesNs.vi>) {
  switch (c) {
    case "soldAt": return formatDateTime(i.soldAt);
    case "state": return <StatusBadge tone={STATE_TONE[i.state]}>{t(`enums.invoiceState.${i.state}`)}</StatusBadge>;
    case "paymentMethod": return enumLabel(t, salesNs, "enums.paymentMethod", i.paymentMethod);
    case "subtotal": case "discount": case "total": case "paid": return formatMoney(i[c]);
    case "customerCode": return <DocCodeLink code={i.customerCode} kind="/customers" />;
    case "returnCodes": return i.returnCodes?.split(", ").map((r, n) => <span key={r}>{n > 0 && ", "}<DocCodeLink code={r} kind="/returns" /></span>);
    default: return i[c];
  }
}

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
  const right = (c: InvoiceColumn) => MONEY.includes(c) && "text-right";
  const star = (on: boolean) => <Star className={cn("size-4", on ? "fill-[#ffb400] text-[#ffb400]" : "text-muted-foreground")} />;
  return (
    <Table>
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
              {MONEY.includes(k) ? formatMoney(data[SUM_KEY[k as keyof typeof SUM_KEY]] ?? 0) : null}</TableCell>)}
          </TableRow>)}
        {data && !data.items.length && <ListEmptyRow cols={span} what={t("invoices.emptyWhat")} onWiden={onWiden} />}
        {data?.items.map((i) => (
          <Fragment key={i.id}>
            <TableRow className={cn("cursor-pointer", expanded === i.id && "bg-primary-tint hover:bg-primary-tint", i.state === "CANCELLED" && "text-muted-foreground")}
              onClick={() => onExpand(expanded === i.id ? null : i.id)}>
              <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
                <button type="button" aria-label={isFav(i.id) ? t("invoices.table.unmark") : t("invoices.table.mark")} onClick={() => onToggleFav(i.id)}>{star(isFav(i.id))}</button></TableCell>
              <TableCell>{i.code}</TableCell>
              {visible.map(([k]) => <TableCell key={k} className={cn(right(k), k === "customerName" && "whitespace-normal", "last:pr-4")}>{cell(i, k, t)}</TableCell>)}
            </TableRow>
            {expanded === i.id && (
              <TableRow className="hover:bg-transparent"><TableCell colSpan={span} className="p-0 whitespace-normal">
                <InvoiceDetailPanel id={i.id} onClose={() => onExpand(null)} /></TableCell></TableRow>)}
          </Fragment>))}
      </TableBody>
    </Table>
  );
}
