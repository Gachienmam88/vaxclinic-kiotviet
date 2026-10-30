"use client";

import { Fragment, useEffect, useState } from "react";
import { DeepLinkRoute, useDeepLinkExpanded, type DeepLink } from "@/components/ui/deep-link-route";
import { DocCodeLink } from "@/components/ui/doc-code-link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { exportReturnsCsv } from "@/features/purchases/purchase-csv-export";
import { PurchaseFilterSidebar } from "@/features/purchases/purchase-filter-sidebar";
import {
  DocStatusBadge, LIST_HEADER_ROW, PurchaseEmptyState, PurchaseListLayout, PurchaseListPager, PurchaseListToolbar,
} from "@/features/purchases/purchase-list-chrome";
import { DEFAULT_PURCHASE_FILTERS, deepLinkPurchaseFilters, useReturns } from "@/features/purchases/purchase-queries";
import { returnStatusLabels } from "@/features/purchases/purchase-types";
import { ReturnDetailPanel } from "@/features/purchases/return-detail-panel";
import { ReturnColumnPicker, useReturnColumns, type ReturnExtraColumn } from "@/features/purchases/return-list-columns";
import { Checkbox } from "@/components/ui/checkbox";
import { useBranches } from "@/features/settings/settings-queries";
import { formatDateTime, formatMoney } from "@/lib/format";
import { useCurrentUser } from "@/lib/use-current-user";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { purchasesNs } from "@/messages/purchases";

const NUM = "text-right";

function PurchaseReturnsPage({ link }: { link: DeepLink }) {
  const { can } = useCurrentUser();
  const t = useT(purchasesNs);
  const tc = useT(commonNs);
  const statusLabels = returnStatusLabels(t);
  const [filters, setFilters] = useState(link.code ? deepLinkPurchaseFilters(link.code) : DEFAULT_PURCHASE_FILTERS);
  const [search, setSearch] = useState(link.code ?? "");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(15);
  useEffect(() => {
    const timer = setTimeout(() => { setFilters((f) => ({ ...f, q: search })); setPage(0); }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  const { data, isLoading } = useReturns(filters, page, size);
  const pages = data ? Math.max(1, Math.ceil(data.total / size)) : 1;
  const applyFilters = (f: typeof filters) => { setFilters(f); setPage(0); };
  const { open: expanded, setOpen: setExpanded, toggle } = useDeepLinkExpanded(data?.items, link, (r) => [r.code]);
  const [extra, toggleExtra] = useReturnColumns();
  const { data: branches = [] } = useBranches();
  const [checked, setChecked] = useState<string[]>([]);
  const has = (c: ReturnExtraColumn) => extra.includes(c);
  const COLS = 10 + extra.length;

  return (
    <PurchaseListLayout title={t("returns.title")}
      toolbar={<PurchaseListToolbar search={search} onSearch={setSearch} placeholder={t("returns.searchPlaceholder")}
        createLabel={can("inventory.manage") ? t("returns.create") : undefined} createHref="/purchases/returns/new"
        onExport={data?.items.length ? () => exportReturnsCsv(data.items, t, tc) : undefined}
        extra={<ReturnColumnPicker shown={extra} onToggle={toggleExtra} />} />}
      sidebar={<PurchaseFilterSidebar filters={filters} statusLabels={statusLabels} personLabel={t("returns.returner")}
        onChange={applyFilters} />}>
      <div className="min-h-[calc(100vh-190px)] overflow-hidden rounded-lg bg-background">
        <Table stickyHeader>
          <TableHeader>
            <TableRow className={LIST_HEADER_ROW}>
              <TableHead className="w-9 pl-4"><Checkbox aria-label={tc("status.all")} checked={!!data?.items.length && checked.length === data.items.length}
                onCheckedChange={(on) => setChecked(on ? (data?.items ?? []).map((r) => r.id) : [])} /></TableHead>
              <TableHead>{t("returns.cols.code")}</TableHead><TableHead>{t("receipts.cols.time")}</TableHead>
              {has("receiptCode") && <TableHead>{t("kv.returnCol.receiptCode")}</TableHead>}
              <TableHead>{t("receipts.cols.supplier")}</TableHead>
              <TableHead className={NUM}>{t("receipts.cols.subtotal")}</TableHead><TableHead className={NUM}>{t("receipts.cols.discount")}</TableHead>
              <TableHead className={NUM}>{t("returns.cols.vatRefund")}</TableHead><TableHead className={NUM}>{t("returns.cols.supplierDue")}</TableHead>
              <TableHead className={NUM}>{t("returns.cols.supplierPaid")}</TableHead>
              {has("createdBy") && <TableHead>{t("kv.returnCol.createdBy")}</TableHead>}
              {has("branch") && <TableHead>{t("kv.returnCol.branch")}</TableHead>}
              {has("note") && <TableHead>{t("kv.returnCol.note")}</TableHead>}
              <TableHead className="pr-4">{tc("fields.status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={COLS} className="py-8 text-center text-muted-foreground">{tc("status.loading")}</TableCell></TableRow>}
            {data && !data.items.length && (
              <TableRow className="hover:bg-transparent"><TableCell colSpan={COLS} className="whitespace-normal">
                <PurchaseEmptyState onWiden={filters.period === "month" ? () => applyFilters({ ...filters, period: "custom", from: "", to: "" }) : undefined} />
              </TableCell></TableRow>
            )}
            {data && data.items.length > 0 && (
              <TableRow className="h-10 font-bold hover:bg-transparent">
                <TableCell colSpan={4 + (has("receiptCode") ? 1 : 0)} />
                <TableCell className={NUM}>{formatMoney(data.sums.subtotal)}</TableCell>
                <TableCell className={NUM}>{formatMoney(data.sums.discount)}</TableCell>
                <TableCell className={NUM}>{formatMoney(data.sums.vatAmount)}</TableCell>
                <TableCell className={NUM}>{formatMoney(data.sums.total)}</TableCell>
                <TableCell className={NUM}>{formatMoney(data.sums.paidAmount)}</TableCell>
                <TableCell colSpan={1 + extra.filter((c) => c !== "receiptCode").length} />
              </TableRow>
            )}
            {data?.items.map((r) => (
              <Fragment key={r.id}>
                <TableRow onClick={() => toggle(r.id)} onKeyDown={(e) => e.key === "Enter" && toggle(r.id)} tabIndex={0}
                  aria-expanded={expanded === r.id}
                  className={cn("cursor-pointer align-top [&>td]:py-2.5", expanded === r.id && "bg-primary-tint hover:bg-primary-tint",
                    r.status === "CANCELLED" && "text-muted-foreground")}>
                  <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
                    <Checkbox aria-label={r.code} checked={checked.includes(r.id)}
                      onCheckedChange={(on) => setChecked((c) => (on ? [...c, r.id] : c.filter((x) => x !== r.id)))} /></TableCell>
                  <TableCell>{r.code}</TableCell><TableCell>{formatDateTime(r.returnedAt)}</TableCell>
                  {has("receiptCode") && <TableCell><DocCodeLink code={r.receiptCode} /></TableCell>}
                  <TableCell className="w-48 max-w-48 whitespace-normal">{r.supplierName}</TableCell>
                  <TableCell className={NUM}>{formatMoney(r.subtotal)}</TableCell>
                  <TableCell className={NUM}>{formatMoney(r.discount)}</TableCell>
                  <TableCell className={NUM}>{formatMoney(r.vatAmount)}</TableCell>
                  <TableCell className={NUM}>{formatMoney(r.total)}</TableCell>
                  <TableCell className={NUM}>{formatMoney(r.refundAmount)}</TableCell>
                  {has("createdBy") && <TableCell>{r.createdByName}</TableCell>}
                  {has("branch") && <TableCell>{branches.find((b) => b.id === r.branchId)?.name}</TableCell>}
                  {has("note") && <TableCell className="max-w-48 truncate" title={r.note ?? ""}>{r.note}</TableCell>}
                  <TableCell className="pr-4"><DocStatusBadge status={r.status} label={statusLabels[r.status]} /></TableCell>
                </TableRow>
                {expanded === r.id && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={COLS} className="p-0 whitespace-normal"><ReturnDetailPanel id={r.id} onClose={() => setExpanded(null)} /></TableCell>
                  </TableRow>
                )}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>
      <PurchaseListPager size={size} onSize={(n) => { setSize(n); setPage(0); }} page={page} pages={pages}
        total={data?.total ?? 0} unit={t("chrome.docUnit")} onPage={setPage} />
    </PurchaseListLayout>
  );
}

/** /purchases/returns?code=THN000123 → lọc theo mã (mọi trạng thái, toàn thời gian) + mở sẵn chi tiết. */
export default function Page() {
  return <DeepLinkRoute>{(link) => <PurchaseReturnsPage link={link} />}</DeepLinkRoute>;
}
