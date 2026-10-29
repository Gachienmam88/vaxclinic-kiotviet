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
import { TAKE_STATUS_KEY } from "@/features/inventory/inventory-types";
import { StockTakeDetailPanel } from "@/features/inventory/stock-take-detail-panel";
import { useInventoryExpanded, useInventoryListState } from "@/features/inventory/use-inventory-list-state";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { useCurrentUser } from "@/lib/use-current-user";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { inventoryNs } from "@/messages/inventory";

const COLS = 10;
const NUM = "text-right";

/** /inventory/stock-takes — danh sách phiếu kiểm kho (KiotViet: Hàng hóa → Kiểm kho). ?code=KK000001 → lọc + mở sẵn. */
function StockTakesPage({ link }: { link: DeepLink }) {
  const tr = useT(inventoryNs);
  const tc = useT(commonNs);
  const statusLabels = Object.fromEntries(Object.entries(TAKE_STATUS_KEY).map(([k, v]) => [k, tr(v)]));
  const { can } = useCurrentUser();
  const s = useInventoryListState(defaultInventoryFilters(["DRAFT", "BALANCED"]), link, Object.keys(TAKE_STATUS_KEY));
  const { data, isLoading } = useStockTakes(s.filters, s.page, s.size);
  const pages = data ? Math.max(1, Math.ceil(data.total / s.size)) : 1;
  const x = useInventoryExpanded(data?.items, link);

  return (
    <PurchaseListLayout title={tr("take.listTitle")}
      toolbar={<PurchaseListToolbar search={s.search} onSearch={s.setSearch} placeholder={tr("take.searchPlaceholder")}
        createLabel={can("inventory.manage") ? tr("take.create") : undefined} createHref="/inventory/stock-takes/new"
        onExport={data?.items.length ? () => exportStockTakesCsv(tr, data.items, s.branchName) : undefined} />}
      sidebar={<PurchaseFilterSidebar filters={s.filters} statusLabels={statusLabels} onChange={s.applyFilters} />}>
      <div className="min-h-[calc(100vh-190px)] overflow-hidden rounded-lg bg-background">
        <Table stickyHeader>
          <TableHeader>
            <TableRow className={LIST_HEADER_ROW}>
              <TableHead className="pl-4">{tr("fields.takeCode")}</TableHead><TableHead>{tr("fields.time")}</TableHead><TableHead>{tr("fields.balancedAt")}</TableHead>
              <TableHead className={NUM}>{tr("fields.actualQty")}</TableHead><TableHead className={NUM}>{tr("fields.actualTotal")}</TableHead>
              <TableHead className={NUM}>{tr("fields.diffTotal")}</TableHead><TableHead className={NUM}>{tr("fields.increaseQty")}</TableHead>
              <TableHead className={NUM}>{tr("fields.decreaseQty")}</TableHead><TableHead>{tr("fields.note")}</TableHead>
              <TableHead className="pr-4">{tr("fields.status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={COLS} className="py-8 text-center text-muted-foreground">{tc("status.loading")}</TableCell></TableRow>}
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
                  <TableCell className="pr-4"><DocStatusBadge status={t.status} label={tr(TAKE_STATUS_KEY[t.status])} /></TableCell>
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
        total={data?.total ?? 0} unit={tr("list.unit")} onPage={s.setPage} />
    </PurchaseListLayout>
  );
}

export default function Page() {
  return <DeepLinkRoute>{(link) => <StockTakesPage link={link} />}</DeepLinkRoute>;
}
