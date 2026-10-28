"use client";

import { Fragment } from "react";
import { DeepLinkRoute, type DeepLink } from "@/components/ui/deep-link-route";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PurchaseFilterSidebar } from "@/features/purchases/purchase-filter-sidebar";
import {
  DocStatusBadge, LIST_HEADER_ROW, PurchaseEmptyState, PurchaseListLayout, PurchaseListPager, PurchaseListToolbar,
} from "@/features/purchases/purchase-list-chrome";
import { exportStockTakesCsv } from "@/features/inventory/inventory-csv-export";
import { defaultInventoryFilters, useStockTakes } from "@/features/inventory/inventory-queries";
import { TAKE_STATUS_LABEL } from "@/features/inventory/inventory-types";
import { StockTakeDetailPanel } from "@/features/inventory/stock-take-detail-panel";
import { useInventoryExpanded, useInventoryListState } from "@/features/inventory/use-inventory-list-state";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { useCurrentUser } from "@/lib/use-current-user";
import { cn } from "@/lib/utils";

const COLS = 10;
const NUM = "text-right";

/** /inventory/stock-takes — danh sách phiếu kiểm kho (KiotViet: Hàng hóa → Kiểm kho). ?code=KK000001 → lọc + mở sẵn. */
function StockTakesPage({ link }: { link: DeepLink }) {
  const { can } = useCurrentUser();
  const s = useInventoryListState(defaultInventoryFilters(["DRAFT", "BALANCED"]), link, Object.keys(TAKE_STATUS_LABEL));
  const { data, isLoading } = useStockTakes(s.filters, s.page, s.size);
  const pages = data ? Math.max(1, Math.ceil(data.total / s.size)) : 1;
  const x = useInventoryExpanded(data?.items, link);

  return (
    <PurchaseListLayout title="Phiếu kiểm kho"
      toolbar={<PurchaseListToolbar search={s.search} onSearch={s.setSearch} placeholder="Theo mã phiếu kiểm"
        createLabel={can("inventory.manage") ? "Kiểm kho" : undefined} createHref="/inventory/stock-takes/new"
        onExport={data?.items.length ? () => exportStockTakesCsv(data.items, s.branchName) : undefined} />}
      sidebar={<PurchaseFilterSidebar filters={s.filters} statusLabels={TAKE_STATUS_LABEL} onChange={s.applyFilters} />}>
      <div className="min-h-[calc(100vh-190px)] overflow-hidden rounded-lg bg-background">
        <Table>
          <TableHeader>
            <TableRow className={LIST_HEADER_ROW}>
              <TableHead className="pl-4">Mã kiểm kho</TableHead><TableHead>Thời gian</TableHead><TableHead>Ngày cân bằng</TableHead>
              <TableHead className={NUM}>SL thực tế</TableHead><TableHead className={NUM}>Tổng thực tế</TableHead>
              <TableHead className={NUM}>Tổng chênh lệch</TableHead><TableHead className={NUM}>SL lệch tăng</TableHead>
              <TableHead className={NUM}>SL lệch giảm</TableHead><TableHead>Ghi chú</TableHead>
              <TableHead className="pr-4">Trạng thái</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={COLS} className="py-8 text-center text-muted-foreground">Đang tải...</TableCell></TableRow>}
            {data && !data.items.length && (
              <TableRow className="hover:bg-transparent"><TableCell colSpan={COLS} className="whitespace-normal">
                <PurchaseEmptyState onWiden={s.filters.period === "month" ? () => s.applyFilters({ ...s.filters, period: "custom", from: "", to: "" }) : undefined} />
              </TableCell></TableRow>
            )}
            {data?.items.map((t) => (
              <Fragment key={t.id}>
                <TableRow onClick={() => x.toggle(t.id)} onKeyDown={(e) => e.key === "Enter" && x.toggle(t.id)} tabIndex={0}
                  aria-expanded={x.expanded === t.id}
                  className={cn("cursor-pointer align-top [&>td]:py-2.5", x.expanded === t.id && "bg-primary-tint hover:bg-primary-tint",
                    t.status === "CANCELLED" && "text-muted-foreground")}>
                  <TableCell className="pl-4">{t.code}</TableCell><TableCell>{formatDateTime(t.takenAt)}</TableCell>
                  <TableCell>{formatDateTime(t.balancedAt)}</TableCell>
                  <TableCell className={NUM}>{formatNumber(t.actualQuantity)}</TableCell>
                  <TableCell className={NUM}>{formatMoney(t.actualValue)}</TableCell>
                  <TableCell className={NUM}>{formatMoney(t.diffValue)}</TableCell>
                  <TableCell className={NUM}>{formatNumber(t.increaseQuantity)}</TableCell>
                  <TableCell className={NUM}>{formatNumber(t.decreaseQuantity)}</TableCell>
                  <TableCell className="max-w-48 truncate" title={t.note ?? ""}>{t.note}</TableCell>
                  <TableCell className="pr-4"><DocStatusBadge status={t.status} label={TAKE_STATUS_LABEL[t.status]} /></TableCell>
                </TableRow>
                {x.expanded === t.id && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={COLS} className="p-0 whitespace-normal"><StockTakeDetailPanel id={t.id} onClose={() => x.toggle(t.id)} /></TableCell>
                  </TableRow>
                )}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>
      <PurchaseListPager size={s.size} onSize={s.setSize} page={s.page} pages={pages}
        total={data?.total ?? 0} unit="phiếu" onPage={s.setPage} />
    </PurchaseListLayout>
  );
}

export default function Page() {
  return <DeepLinkRoute>{(link) => <StockTakesPage link={link} />}</DeepLinkRoute>;
}
