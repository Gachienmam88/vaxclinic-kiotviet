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
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { inventoryNs } from "@/messages/inventory";
import { cn } from "@/lib/utils";
import { exportStockIssuesCsv } from "./inventory-csv-export";
import { defaultInventoryFilters, useStockIssues } from "./inventory-queries";
import { ISSUE_CONFIG, ISSUE_STATUS_KEY, type IssueType } from "./inventory-types";
import { StockIssueDetailPanel } from "./stock-issue-detail-panel";
import { useInventoryExpanded, useInventoryListState } from "./use-inventory-list-state";

const COLS = 6;

function StockIssueList({ type, link }: { type: IssueType; link: DeepLink }) {
  const cfg = ISSUE_CONFIG[type];
  const t = useT(inventoryNs);
  const tc = useT(commonNs);
  const title = t(`issue.${cfg.msg}.title`);
  const statusLabels = Object.fromEntries(Object.entries(ISSUE_STATUS_KEY).map(([k, v]) => [k, t(v)]));
  const { can } = useCurrentUser();
  const s = useInventoryListState(defaultInventoryFilters(["DRAFT", "COMPLETED"]), link, Object.keys(ISSUE_STATUS_KEY));
  const { data, isLoading } = useStockIssues(type, s.filters, s.page, s.size);
  const pages = data ? Math.max(1, Math.ceil(data.total / s.size)) : 1;
  const x = useInventoryExpanded(data?.items, link);

  return (
    <PurchaseListLayout title={title}
      toolbar={<PurchaseListToolbar search={s.search} onSearch={s.setSearch} placeholder={t(`issue.${cfg.msg}.searchPlaceholder`)}
        createLabel={can("inventory.manage") ? title : undefined} createHref={`${cfg.listPath}/new`}
        onExport={data?.items.length ? () => exportStockIssuesCsv(t, type, data.items, s.branchName) : undefined} />}
      sidebar={<PurchaseFilterSidebar filters={s.filters} statusLabels={statusLabels} onChange={s.applyFilters} />}>
      <div className="min-h-[calc(100vh-190px)] overflow-hidden rounded-lg bg-background">
        <Table stickyHeader>
          <TableHeader>
            <TableRow className={LIST_HEADER_ROW}>
              <TableHead className="pl-4">{t(`issue.${cfg.msg}.codeLabel`)}</TableHead><TableHead className="text-right">{t(`issue.${cfg.msg}.valueLabel`)}</TableHead>
              <TableHead>{t("fields.time")}</TableHead><TableHead>{t("fields.branch")}</TableHead><TableHead>{t("fields.note")}</TableHead>
              <TableHead className="pr-4">{t("fields.status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={COLS} className="py-8 text-center text-muted-foreground">{tc("status.loading")}</TableCell></TableRow>}
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
                  <TableCell className="pr-4"><DocStatusBadge status={d.status} label={t(ISSUE_STATUS_KEY[d.status])} /></TableCell>
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
        total={data?.total ?? 0} unit={t("list.unit")} onPage={s.setPage} />
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
