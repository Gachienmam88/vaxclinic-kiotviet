"use client";

import { Fragment, useEffect, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { exportReceiptsCsv } from "@/features/purchases/purchase-csv-export";
import { PurchaseFilterSidebar } from "@/features/purchases/purchase-filter-sidebar";
import {
  DocStatusBadge, LIST_HEADER_ROW, PurchaseEmptyState, PurchaseListLayout, PurchaseListPager, PurchaseListToolbar,
} from "@/features/purchases/purchase-list-chrome";
import { DEFAULT_PURCHASE_FILTERS, useReceipts } from "@/features/purchases/purchase-queries";
import { RECEIPT_STATUS_LABEL } from "@/features/purchases/purchase-types";
import { ReceiptDetailPanel } from "@/features/purchases/receipt-detail-panel";
import { formatDateTime, formatMoney } from "@/lib/format";
import { useCurrentUser } from "@/lib/use-current-user";
import { cn } from "@/lib/utils";

const COLS = 11;
const NUM = "text-right";

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
  const applyFilters = (f: typeof filters) => { setFilters(f); setPage(0); };

  return (
    <PurchaseListLayout title="Nhập hàng"
      toolbar={<PurchaseListToolbar search={search} onSearch={setSearch} placeholder="Theo mã phiếu nhập"
        createLabel={can("inventory.manage") ? "Nhập hàng" : undefined} createHref="/purchases/receipts/new"
        onExport={data?.items.length ? () => exportReceiptsCsv(data.items) : undefined} />}
      sidebar={<PurchaseFilterSidebar filters={filters} statusLabels={RECEIPT_STATUS_LABEL} personLabel="Người nhập" showInvoiceNo
        onChange={applyFilters} />}>
      <div className="min-h-[calc(100vh-190px)] overflow-hidden rounded-lg bg-background">
        <Table>
          <TableHeader>
            <TableRow className={LIST_HEADER_ROW}>
              <TableHead className="pl-4">Mã nhập hàng</TableHead><TableHead>Thời gian</TableHead><TableHead>Mã NCC</TableHead>
              <TableHead>Nhà cung cấp</TableHead><TableHead className={NUM}>VAT nhập hàng</TableHead>
              <TableHead className={NUM}>Cần trả NCC</TableHead><TableHead className={NUM}>Tiền đã trả NCC</TableHead>
              <TableHead className={NUM}>Tổng tiền hàng</TableHead><TableHead className={NUM}>Giảm giá</TableHead>
              <TableHead>Số HĐ đầu vào</TableHead><TableHead className="pr-4">Trạng thái</TableHead>
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
                <TableCell colSpan={4} />
                <TableCell className={NUM}>{formatMoney(data.sums.vatAmount)}</TableCell>
                <TableCell className={NUM}>{formatMoney(data.sums.total)}</TableCell>
                <TableCell className={NUM}>{formatMoney(data.sums.paidAmount)}</TableCell>
                <TableCell className={NUM}>{formatMoney(data.sums.subtotal)}</TableCell>
                <TableCell className={NUM}>{formatMoney(data.sums.discount)}</TableCell>
                <TableCell colSpan={2} />
              </TableRow>
            )}
            {data?.items.map((r) => (
              <Fragment key={r.id}>
                <TableRow onClick={() => setExpanded(expanded === r.id ? null : r.id)} aria-expanded={expanded === r.id}
                  className={cn("cursor-pointer align-top [&>td]:py-2.5", expanded === r.id && "bg-[#e3f0fc] hover:bg-[#e3f0fc]",
                    r.status === "CANCELLED" && "text-muted-foreground")}>
                  <TableCell className={cn("pl-4", r.status === "CANCELLED" && "line-through")}>{r.code}</TableCell>
                  <TableCell>{formatDateTime(r.receivedAt)}</TableCell>
                  <TableCell>{r.supplierCode}</TableCell>
                  <TableCell className="w-40 max-w-40 whitespace-normal">{r.supplierName}</TableCell>
                  <TableCell className={NUM}>{formatMoney(r.vatAmount)}</TableCell>
                  <TableCell className={NUM}>{formatMoney(r.total)}</TableCell>
                  <TableCell className={NUM}>{formatMoney(r.paidAmount)}</TableCell>
                  <TableCell className={NUM}>{formatMoney(r.subtotal)}</TableCell>
                  <TableCell className={NUM}>{formatMoney(r.discount)}</TableCell>
                  <TableCell>{r.inputInvoiceNo}</TableCell>
                  <TableCell className="pr-4"><DocStatusBadge status={r.status} label={RECEIPT_STATUS_LABEL[r.status]} /></TableCell>
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
      <PurchaseListPager size={size} onSize={(n) => { setSize(n); setPage(0); }} page={page} pages={pages}
        total={data?.total ?? 0} unit="phiếu" onPage={setPage} />
    </PurchaseListLayout>
  );
}
