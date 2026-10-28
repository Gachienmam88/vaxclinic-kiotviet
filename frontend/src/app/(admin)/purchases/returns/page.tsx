"use client";

import { Fragment, useEffect, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { exportReturnsCsv } from "@/features/purchases/purchase-csv-export";
import { PurchaseFilterSidebar } from "@/features/purchases/purchase-filter-sidebar";
import {
  DocStatusBadge, LIST_HEADER_ROW, PurchaseEmptyState, PurchaseListLayout, PurchaseListPager, PurchaseListToolbar,
} from "@/features/purchases/purchase-list-chrome";
import { DEFAULT_PURCHASE_FILTERS, useReturns } from "@/features/purchases/purchase-queries";
import { RETURN_STATUS_LABEL } from "@/features/purchases/purchase-types";
import { ReturnDetailPanel } from "@/features/purchases/return-detail-panel";
import { formatDateTime, formatMoney } from "@/lib/format";
import { useCurrentUser } from "@/lib/use-current-user";
import { cn } from "@/lib/utils";

const COLS = 10;
const NUM = "text-right";

export default function PurchaseReturnsPage() {
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
  const { data, isLoading } = useReturns(filters, page, size);
  const pages = data ? Math.max(1, Math.ceil(data.total / size)) : 1;
  const applyFilters = (f: typeof filters) => { setFilters(f); setPage(0); };
  const toggle = (id: string) => setExpanded(expanded === id ? null : id);

  return (
    <PurchaseListLayout title="Trả hàng nhập"
      toolbar={<PurchaseListToolbar search={search} onSearch={setSearch} placeholder="Theo mã phiếu trả"
        createLabel={can("inventory.manage") ? "Trả hàng nhập" : undefined} createHref="/purchases/returns/new"
        onExport={data?.items.length ? () => exportReturnsCsv(data.items) : undefined} />}
      sidebar={<PurchaseFilterSidebar filters={filters} statusLabels={RETURN_STATUS_LABEL} personLabel="Người trả"
        onChange={applyFilters} />}>
      <div className="min-h-[calc(100vh-190px)] overflow-hidden rounded-lg bg-background">
        <Table>
          <TableHeader>
            <TableRow className={LIST_HEADER_ROW}>
              <TableHead className="pl-4">Mã trả hàng nhập</TableHead><TableHead>Thời gian</TableHead><TableHead>Nhà cung cấp</TableHead>
              <TableHead className={NUM}>Tổng tiền hàng</TableHead><TableHead className={NUM}>Giảm giá</TableHead>
              <TableHead className={NUM}>VAT hoàn trả</TableHead><TableHead className={NUM}>NCC cần trả</TableHead>
              <TableHead className={NUM}>NCC đã trả</TableHead><TableHead>Theo phiếu nhập</TableHead>
              <TableHead className="pr-4">Trạng thái</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={COLS} className="py-8 text-center text-muted-foreground">Đang tải...</TableCell></TableRow>}
            {data && !data.items.length && (
              <TableRow className="hover:bg-transparent"><TableCell colSpan={COLS} className="whitespace-normal">
                <PurchaseEmptyState onWiden={filters.period === "month" ? () => applyFilters({ ...filters, period: "custom", from: "", to: "" }) : undefined} />
              </TableCell></TableRow>
            )}
            {data && data.items.length > 0 && (
              <TableRow className="h-10 font-bold hover:bg-transparent">
                <TableCell colSpan={3} />
                <TableCell className={NUM}>{formatMoney(data.sums.subtotal)}</TableCell>
                <TableCell className={NUM}>{formatMoney(data.sums.discount)}</TableCell>
                <TableCell className={NUM}>{formatMoney(data.sums.vatAmount)}</TableCell>
                <TableCell className={NUM}>{formatMoney(data.sums.total)}</TableCell>
                <TableCell className={NUM}>{formatMoney(data.sums.paidAmount)}</TableCell>
                <TableCell colSpan={2} />
              </TableRow>
            )}
            {data?.items.map((r) => (
              <Fragment key={r.id}>
                <TableRow onClick={() => toggle(r.id)} onKeyDown={(e) => e.key === "Enter" && toggle(r.id)} tabIndex={0}
                  aria-expanded={expanded === r.id}
                  className={cn("cursor-pointer align-top [&>td]:py-2.5", expanded === r.id && "bg-[#e3f0fc] hover:bg-[#e3f0fc]",
                    r.status === "CANCELLED" && "text-muted-foreground")}>
                  <TableCell className="pl-4">{r.code}</TableCell><TableCell>{formatDateTime(r.returnedAt)}</TableCell>
                  <TableCell className="w-48 max-w-48 whitespace-normal">{r.supplierName}</TableCell>
                  <TableCell className={NUM}>{formatMoney(r.subtotal)}</TableCell>
                  <TableCell className={NUM}>{formatMoney(r.discount)}</TableCell>
                  <TableCell className={NUM}>{formatMoney(r.vatAmount)}</TableCell>
                  <TableCell className={NUM}>{formatMoney(r.total)}</TableCell>
                  <TableCell className={NUM}>{formatMoney(r.refundAmount)}</TableCell>
                  <TableCell>{r.receiptCode}</TableCell>
                  <TableCell className="pr-4"><DocStatusBadge status={r.status} label={RETURN_STATUS_LABEL[r.status]} /></TableCell>
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
      <PurchaseListPager size={size} onSize={(n) => { setSize(n); setPage(0); }} page={page} pages={pages}
        total={data?.total ?? 0} unit="phiếu" onPage={setPage} />
    </PurchaseListLayout>
  );
}
