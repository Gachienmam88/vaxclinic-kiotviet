"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PurchaseFilterSidebar } from "@/features/purchases/purchase-filter-sidebar";
import { DEFAULT_PURCHASE_FILTERS, useReceipts } from "@/features/purchases/purchase-queries";
import { RECEIPT_STATUS_LABEL } from "@/features/purchases/purchase-types";
import { ReceiptDetailPanel } from "@/features/purchases/receipt-detail-panel";
import { formatDateTime, formatMoney } from "@/lib/format";
import { useCurrentUser } from "@/lib/use-current-user";
import { cn } from "@/lib/utils";

const COLS = 11;

export default function ReceiptsPage() {
  const { can } = useCurrentUser();
  const [filters, setFilters] = useState(DEFAULT_PURCHASE_FILTERS);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(15);
  const [expanded, setExpanded] = useState<string | null>(null);
  useEffect(() => {
    const t = setTimeout(() => { setFilters((f) => ({ ...f, q: search })); setPage(0); }, 300);
    return () => clearTimeout(t);
  }, [search]);
  const { data, isLoading } = useReceipts(filters, page, size);
  const pages = data ? Math.max(1, Math.ceil(data.total / size)) : 1;

  return (
    <div className="flex gap-4">
      <div className="space-y-4">
        <h1 className="text-xl font-bold">Nhập hàng</h1>
        <PurchaseFilterSidebar filters={filters} statusLabels={RECEIPT_STATUS_LABEL} personLabel="Người nhập" showInvoiceNo
          onChange={(f) => { setFilters(f); setPage(0); }} />
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative w-full max-w-md">
            <Search className="absolute top-2 left-2.5 size-4 text-muted-foreground" />
            <Input className="bg-background pl-8" placeholder="Theo mã phiếu nhập" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {can("inventory.manage") && (
            <Button className="ml-auto" render={<Link href="/purchases/receipts/new" />}><Plus className="size-4" /> Nhập hàng</Button>
          )}
        </div>
        <div className="overflow-x-auto rounded-lg bg-background">
          <Table>
            <TableHeader>
              <TableRow className="bg-primary/10 hover:bg-primary/10">
                <TableHead>Mã nhập hàng</TableHead><TableHead>Thời gian</TableHead><TableHead>Mã NCC</TableHead>
                <TableHead>Nhà cung cấp</TableHead><TableHead>Số HĐ đầu vào</TableHead>
                <TableHead className="text-right">Tổng tiền hàng</TableHead><TableHead className="text-right">Giảm giá</TableHead>
                <TableHead className="text-right">VAT nhập hàng</TableHead><TableHead className="text-right">Cần trả NCC</TableHead>
                <TableHead className="text-right">Tiền đã trả NCC</TableHead><TableHead>Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="font-semibold hover:bg-transparent">
                <TableCell colSpan={5} />
                <TableCell className="text-right">{formatMoney(data?.sums.subtotal ?? 0)}</TableCell>
                <TableCell className="text-right">{formatMoney(data?.sums.discount ?? 0)}</TableCell>
                <TableCell className="text-right">{formatMoney(data?.sums.vatAmount ?? 0)}</TableCell>
                <TableCell className="text-right">{formatMoney(data?.sums.total ?? 0)}</TableCell>
                <TableCell className="text-right">{formatMoney(data?.sums.paidAmount ?? 0)}</TableCell><TableCell />
              </TableRow>
              {isLoading && <TableRow><TableCell colSpan={COLS} className="py-8 text-center text-muted-foreground">Đang tải...</TableCell></TableRow>}
              {data && !data.items.length && (
                <TableRow><TableCell colSpan={COLS} className="py-12 text-center text-muted-foreground">Không tìm thấy phiếu nhập nào phù hợp</TableCell></TableRow>
              )}
              {data?.items.map((r) => (
                <Fragment key={r.id}>
                  <TableRow onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                    className={cn("cursor-pointer align-top", expanded === r.id && "bg-primary/5", r.status === "CANCELLED" && "text-muted-foreground line-through")}>
                    <TableCell className="font-medium">{r.code}</TableCell>
                    <TableCell>{formatDateTime(r.receivedAt)}</TableCell>
                    <TableCell>{r.supplierCode}</TableCell>
                    <TableCell className="max-w-56 whitespace-normal">{r.supplierName}</TableCell>
                    <TableCell>{r.inputInvoiceNo}</TableCell>
                    <TableCell className="text-right">{formatMoney(r.subtotal)}</TableCell>
                    <TableCell className="text-right">{formatMoney(r.discount)}</TableCell>
                    <TableCell className="text-right">{formatMoney(r.vatAmount)}</TableCell>
                    <TableCell className="text-right">{formatMoney(r.total)}</TableCell>
                    <TableCell className="text-right">{formatMoney(r.paidAmount)}</TableCell>
                    <TableCell className="no-underline"><Badge variant={r.status === "DRAFT" ? "secondary" : r.status === "CANCELLED" ? "destructive" : "default"}>
                      {RECEIPT_STATUS_LABEL[r.status]}</Badge></TableCell>
                  </TableRow>
                  {expanded === r.id && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={COLS} className="p-0 whitespace-normal"><ReceiptDetailPanel id={r.id} /></TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span>Hiển thị</span>
          <select className="h-8 rounded-md border bg-background px-2" value={size}
            onChange={(e) => { setSize(Number(e.target.value)); setPage(0); }}>
            {[15, 30, 50, 100].map((n) => <option key={n} value={n}>{n} dòng</option>)}
          </select>
          <span className="ml-auto text-muted-foreground">{data?.total ?? 0} phiếu — trang {page + 1}/{pages}</span>
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Trước</Button>
          <Button size="sm" variant="outline" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Sau</Button>
        </div>
      </div>
    </div>
  );
}
