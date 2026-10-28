"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { Inbox, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PurchaseFilterSidebar } from "@/features/purchases/purchase-filter-sidebar";
import { DEFAULT_PURCHASE_FILTERS, useReturns } from "@/features/purchases/purchase-queries";
import { RETURN_STATUS_LABEL } from "@/features/purchases/purchase-types";
import { ReturnDetailPanel } from "@/features/purchases/return-detail-panel";
import { formatDateTime, formatMoney } from "@/lib/format";
import { useCurrentUser } from "@/lib/use-current-user";
import { cn } from "@/lib/utils";

const COLS = 9;

export default function PurchaseReturnsPage() {
  const { can } = useCurrentUser();
  const [filters, setFilters] = useState(DEFAULT_PURCHASE_FILTERS);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  useEffect(() => {
    const t = setTimeout(() => { setFilters((f) => ({ ...f, q: search })); setPage(0); }, 300);
    return () => clearTimeout(t);
  }, [search]);
  const { data, isLoading } = useReturns(filters, page, 15);
  const pages = data ? Math.max(1, Math.ceil(data.total / 15)) : 1;

  return (
    <div className="flex gap-4">
      <div className="space-y-4">
        <h1 className="text-xl font-bold">Trả hàng nhập</h1>
        <PurchaseFilterSidebar filters={filters} statusLabels={RETURN_STATUS_LABEL} personLabel="Người trả"
          onChange={(f) => { setFilters(f); setPage(0); }} />
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative w-full max-w-md">
            <Search className="absolute top-2 left-2.5 size-4 text-muted-foreground" />
            <Input className="bg-background pl-8" placeholder="Theo mã phiếu trả" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {can("inventory.manage") && (
            <Button className="ml-auto" render={<Link href="/purchases/returns/new" />}><Plus className="size-4" /> Trả hàng nhập</Button>
          )}
        </div>
        <div className="overflow-x-auto rounded-lg bg-background">
          <Table>
            <TableHeader>
              <TableRow className="bg-primary/10 hover:bg-primary/10">
                <TableHead>Mã trả hàng nhập</TableHead><TableHead>Thời gian</TableHead><TableHead>Nhà cung cấp</TableHead>
                <TableHead>Theo phiếu nhập</TableHead><TableHead className="text-right">Tổng tiền hàng</TableHead>
                <TableHead className="text-right">Giảm giá</TableHead><TableHead className="text-right">VAT</TableHead>
                <TableHead className="text-right">NCC cần trả</TableHead><TableHead>Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={COLS} className="py-8 text-center text-muted-foreground">Đang tải...</TableCell></TableRow>}
              {data && !data.items.length && (
                <TableRow className="hover:bg-transparent"><TableCell colSpan={COLS} className="py-16 text-center">
                  <Inbox className="mx-auto mb-3 size-12 text-primary/50" />
                  <p className="font-semibold">Không tìm thấy kết quả</p>
                  <p className="text-muted-foreground">Không tìm thấy giao dịch nào phù hợp trong khoảng thời gian đã chọn.</p>
                </TableCell></TableRow>
              )}
              {data && data.items.length > 0 && (
                <TableRow className="font-semibold hover:bg-transparent">
                  <TableCell colSpan={4} />
                  <TableCell className="text-right">{formatMoney(data.sums.subtotal)}</TableCell>
                  <TableCell className="text-right">{formatMoney(data.sums.discount)}</TableCell>
                  <TableCell className="text-right">{formatMoney(data.sums.vatAmount)}</TableCell>
                  <TableCell className="text-right">{formatMoney(data.sums.total)}</TableCell><TableCell />
                </TableRow>
              )}
              {data?.items.map((r) => (
                <Fragment key={r.id}>
                  <TableRow onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                    className={cn("cursor-pointer", expanded === r.id && "bg-primary/5", r.status === "CANCELLED" && "text-muted-foreground")}>
                    <TableCell className="font-medium">{r.code}</TableCell><TableCell>{formatDateTime(r.returnedAt)}</TableCell>
                    <TableCell className="max-w-56 whitespace-normal">{r.supplierName}</TableCell><TableCell>{r.receiptCode}</TableCell>
                    <TableCell className="text-right">{formatMoney(r.subtotal)}</TableCell>
                    <TableCell className="text-right">{formatMoney(r.discount)}</TableCell>
                    <TableCell className="text-right">{formatMoney(r.vatAmount)}</TableCell>
                    <TableCell className="text-right">{formatMoney(r.total)}</TableCell>
                    <TableCell><Badge variant={r.status === "DRAFT" ? "secondary" : r.status === "CANCELLED" ? "destructive" : "default"}>
                      {RETURN_STATUS_LABEL[r.status]}</Badge></TableCell>
                  </TableRow>
                  {expanded === r.id && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={COLS} className="p-0 whitespace-normal"><ReturnDetailPanel id={r.id} /></TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-end gap-2 text-sm">
          <span className="text-muted-foreground">{data?.total ?? 0} phiếu — trang {page + 1}/{pages}</span>
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Trước</Button>
          <Button size="sm" variant="outline" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Sau</Button>
        </div>
      </div>
    </div>
  );
}
