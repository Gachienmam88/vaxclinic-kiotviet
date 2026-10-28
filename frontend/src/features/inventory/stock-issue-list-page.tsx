"use client";

import { Fragment } from "react";
import { DeepLinkRoute, type DeepLink } from "@/components/ui/deep-link-route";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PurchaseFilterSidebar } from "@/features/purchases/purchase-filter-sidebar";
import {
  DocStatusBadge, LIST_HEADER_ROW, PurchaseEmptyState, PurchaseListLayout, PurchaseListPager, PurchaseListToolbar,
} from "@/features/purchases/purchase-list-chrome";
import { formatDateTime, formatMoney } from "@/lib/format";
import { useCurrentUser } from "@/lib/use-current-user";
import { cn } from "@/lib/utils";
import { exportStockIssuesCsv } from "./inventory-csv-export";
import { defaultInventoryFilters, useStockIssues } from "./inventory-queries";
import { ISSUE_CONFIG, ISSUE_STATUS_LABEL, type IssueType } from "./inventory-types";
import { StockIssueDetailPanel } from "./stock-issue-detail-panel";
import { useInventoryExpanded, useInventoryListState } from "./use-inventory-list-state";

const COLS = 6;

function StockIssueList({ type, link }: { type: IssueType; link: DeepLink }) {
  const cfg = ISSUE_CONFIG[type];
  const { can } = useCurrentUser();
  const s = useInventoryListState(defaultInventoryFilters(["DRAFT", "COMPLETED"]), link, Object.keys(ISSUE_STATUS_LABEL));
  const { data, isLoading } = useStockIssues(type, s.filters, s.page, s.size);
  const pages = data ? Math.max(1, Math.ceil(data.total / s.size)) : 1;
  const x = useInventoryExpanded(data?.items, link);

  return (
    <PurchaseListLayout title={cfg.title}
      toolbar={<PurchaseListToolbar search={s.search} onSearch={s.setSearch} placeholder={`Theo ${cfg.codeLabel.toLowerCase()}`}
        createLabel={can("inventory.manage") ? cfg.title : undefined} createHref={`${cfg.listPath}/new`}
        onExport={data?.items.length ? () => exportStockIssuesCsv(type, data.items, s.branchName) : undefined} />}
      sidebar={<PurchaseFilterSidebar filters={s.filters} statusLabels={ISSUE_STATUS_LABEL} onChange={s.applyFilters} />}>
      <div className="min-h-[calc(100vh-190px)] overflow-hidden rounded-lg bg-background">
        <Table>
          <TableHeader>
            <TableRow className={LIST_HEADER_ROW}>
              <TableHead className="pl-4">{cfg.codeLabel}</TableHead><TableHead className="text-right">{cfg.valueLabel}</TableHead>
              <TableHead>Thời gian</TableHead><TableHead>Chi nhánh</TableHead><TableHead>Ghi chú</TableHead>
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
            {data?.items.map((d) => (
              <Fragment key={d.id}>
                <TableRow onClick={() => x.toggle(d.id)} onKeyDown={(e) => e.key === "Enter" && x.toggle(d.id)} tabIndex={0}
                  aria-expanded={x.expanded === d.id}
                  className={cn("cursor-pointer align-top [&>td]:py-2.5", x.expanded === d.id && "bg-primary-tint hover:bg-primary-tint",
                    d.status === "CANCELLED" && "text-muted-foreground")}>
                  <TableCell className="pl-4">{d.code}</TableCell>
                  <TableCell className="text-right">{formatMoney(d.totalValue)}</TableCell>
                  <TableCell>{formatDateTime(d.issuedAt)}</TableCell><TableCell>{s.branchName(d.branchId)}</TableCell>
                  <TableCell className="max-w-64 truncate" title={d.note ?? ""}>{d.note}</TableCell>
                  <TableCell className="pr-4"><DocStatusBadge status={d.status} label={ISSUE_STATUS_LABEL[d.status]} /></TableCell>
                </TableRow>
                {x.expanded === d.id && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={COLS} className="p-0 whitespace-normal"><StockIssueDetailPanel type={type} id={d.id} onClose={() => x.toggle(d.id)} /></TableCell>
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

/**
 * Danh sách Xuất hủy (/inventory/damages) và Xuất dùng nội bộ (/inventory/internal-use) — cùng bố cục Mua hàng.
 * Link sâu ?code=XH000001 / XNB000001 → lọc theo mã (mọi trạng thái, toàn thời gian) + mở sẵn chi tiết.
 */
export function StockIssueListPage({ type }: { type: IssueType }) {
  return <DeepLinkRoute>{(link) => <StockIssueList type={type} link={link} />}</DeepLinkRoute>;
}
