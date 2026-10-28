"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { Eye, FilePlus2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DETAIL_PANEL, LIST_HEAD_ROW, StatusBadge, SUB_HEAD } from "@/features/sales/invoice-list-kit";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { NATURE_LABEL, type InputInvoice } from "./integration-queries";

const COLS = 8;

/** Bảng "Danh sách hóa đơn" đầu vào: dòng tổng, badge lập phiếu / tính chất, cột Thao tác, mở chi tiết dưới dòng. */
export function InputInvoiceTable({ items, sumTotal }: { items: InputInvoice[] | undefined; sumTotal: number }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const toggle = (id: string) => setExpanded(expanded === id ? null : id);
  return (
    <div className="overflow-x-auto rounded-lg bg-background">
      <Table>
        <TableHeader><TableRow className={LIST_HEAD_ROW}>
          <TableHead className="pl-4">Số hóa đơn</TableHead><TableHead>Ngày hóa đơn</TableHead><TableHead>Nhà cung cấp</TableHead>
          <TableHead>Mã số thuế</TableHead><TableHead className="text-right">Tổng tiền</TableHead>
          <TableHead>Trạng thái lập phiếu</TableHead><TableHead>Tính chất</TableHead><TableHead className="pr-4 text-right">Thao tác</TableHead></TableRow></TableHeader>
        <TableBody>
          <TableRow className="font-bold hover:bg-transparent"><TableCell colSpan={4} />
            <TableCell className="text-right">{formatMoney(sumTotal)}</TableCell><TableCell colSpan={3} /></TableRow>
          {items && !items.length && <TableRow><TableCell colSpan={COLS} className="py-10 text-center text-muted-foreground">Chưa có hóa đơn — đồng bộ từ cổng thuế hoặc nhập file XML</TableCell></TableRow>}
          {items?.map((i) => (
            <Fragment key={i.id}>
              <TableRow className={cn("cursor-pointer align-top", expanded === i.id && "bg-[#e3f0fc] hover:bg-[#e3f0fc]")} onClick={() => toggle(i.id)}>
                <TableCell className="pl-4">{i.number}</TableCell><TableCell>{formatDate(i.issuedAt)}</TableCell>
                <TableCell className="max-w-72 whitespace-normal">{i.sellerName} - {i.sellerTaxCode}</TableCell>
                <TableCell>{i.buyerTaxCode}</TableCell><TableCell className="text-right">{formatMoney(i.total)}</TableCell>
                <TableCell>{i.receiptId
                  ? <StatusBadge tone="green">Đã lập phiếu {i.receiptCode}</StatusBadge>
                  : <StatusBadge tone="gray">Chưa lập phiếu</StatusBadge>}</TableCell>
                <TableCell><StatusBadge tone="gray">{NATURE_LABEL[i.nature]}</StatusBadge></TableCell>
                <TableCell className="pr-4" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-end gap-1.5">
                    {!i.receiptId && <Button size="sm" className="h-7 rounded-md" render={<Link href={`/purchases/receipts/new?fromInputInvoice=${i.id}`} />}>
                      <FilePlus2 className="size-3.5" /> Lập phiếu nhập</Button>}
                    <button type="button" aria-label={`Xem chi tiết hóa đơn ${i.number}`} aria-expanded={expanded === i.id} onClick={() => toggle(i.id)}
                      className="inline-flex size-7 items-center justify-center rounded-md border bg-background hover:bg-muted"><Eye className="size-4" /></button>
                  </div>
                </TableCell>
              </TableRow>
              {expanded === i.id && (
                <TableRow className="hover:bg-transparent"><TableCell colSpan={COLS} className="p-0 whitespace-normal">
                  <div className={cn(DETAIL_PANEL, "space-y-3 p-4")}>
                    <p>Ký hiệu <b>{i.templateNo}{i.series}</b> · số <b>{i.number}</b> · trước thuế {formatMoney(i.totalBeforeTax ?? 0)} · thuế {formatMoney(i.vatAmount ?? 0)} · nguồn {i.source === "XML" ? "file XML" : "cổng thuế"}</p>
                    <table className="w-full"><thead className={SUB_HEAD}><tr><th className="pl-2.5">Tên hàng</th><th>ĐVT</th>
                      <th className="text-right">Số lượng</th><th className="text-right">Đơn giá</th><th>Thuế suất</th><th className="pr-2.5 text-right">Thành tiền</th></tr></thead>
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
