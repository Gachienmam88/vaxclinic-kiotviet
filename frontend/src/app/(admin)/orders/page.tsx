"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileOutput, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ListEmptyRow } from "@/components/ui/list-empty-state";
import { DeepLinkRoute, useDeepLinkExpanded, type DeepLink } from "@/components/ui/deep-link-route";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { OrderDetailPanel } from "@/features/orders/order-detail-panel";
import { OrderFilterSidebar, type OrderFilters } from "@/features/orders/order-filter-sidebar";
import { useOrders } from "@/features/orders/order-queries";
import { ORDER_STATUS_KEY, ORDER_STATUS_TONE } from "@/features/orders/order-types";
import { LIST_HEAD_ROW, ListSearch, PageTitle, StatusBadge, TOOLBAR_BTN } from "@/features/sales/invoice-list-kit";
import { downloadCsv, ListPager } from "@/features/sales/invoice-list-pager";
import { periodParams } from "@/features/sales/sales-queries";
import { formatDateTime, formatMoney } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { commonNs } from "@/messages/common";
import { ordersNs } from "@/messages/orders";

const COLS = 7;

/**
 * Đặt hàng: danh sách đơn kiểu KiotViet (lọc trái, dòng tổng, chi tiết mở dưới dòng). Tạo / sửa đơn ở màn bán hàng.
 * Link sâu: /orders?code=DH000001 (lọc theo mã, mọi thời gian + trạng thái, mở chi tiết) hoặc ?id=<uuid>.
 */
function OrdersPage({ link }: { link: DeepLink }) {
  const t = useT(ordersNs);
  const tc = useT(commonNs);
  const deepLink = !!(link.code || link.id);
  const [search, setSearch] = useState(link.code ?? "");
  const [q, setQ] = useState(link.code ?? "");
  const [filters, setFilters] = useState<OrderFilters>({
    period: { mode: deepLink ? "all" : "month", from: "", to: "" },
    statuses: deepLink ? ["DRAFT", "CONFIRMED", "COMPLETED", "CANCELLED"] : ["DRAFT", "CONFIRMED"], createdBy: "",
  });
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(15);
  useEffect(() => { const t = setTimeout(() => { setQ(search); setPage(0); }, 300); return () => clearTimeout(t); }, [search]);

  const params = useMemo(() => {
    const p = periodParams(filters.period, new URLSearchParams({ page: String(page), size: String(size) }));
    if (q) p.set("q", q);
    filters.statuses.forEach((s) => p.append("statuses", s));
    if (filters.createdBy) p.set("createdBy", filters.createdBy);
    return p;
  }, [q, filters, page, size]);
  const { data } = useOrders(params);
  const { open: expanded, setOpen: setExpanded, toggle } = useDeepLinkExpanded(data?.items, link, (o) => [o.code]);

  const exportCsv = () => downloadCsv(t("csv.listFile"), (["code", "time", "customerCode", "customer", "subtotal", "discount",
    "total", "paid", "status", "invoice"] as const).map((k) => t(`cols.${k}`)), (data?.items ?? []).map((o) => [o.code,
    formatDateTime(o.orderedAt), o.customerCode, o.customerName, o.subtotal, o.discount, o.total, o.deposit, t(ORDER_STATUS_KEY[o.status]),
    o.invoiceCode]));

  return (
    <div className="flex gap-2.5">
      <div className="space-y-3">
        <PageTitle>{t("list.title")}</PageTitle>
        <OrderFilterSidebar value={filters} onChange={(f) => { setFilters(f); setPage(0); }} />
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex items-center gap-2">
          <ListSearch value={search} onChange={setSearch} placeholder={t("list.searchPlaceholder")} />
          <Button variant="outline" className={cn(TOOLBAR_BTN, "ml-auto")} render={<Link href="/sale" />}
            title={t("list.newOrderHint")}><Plus className="size-4" /> {t("list.newOrder")}</Button>
          <Button variant="outline" className={TOOLBAR_BTN} disabled={!data?.items.length} onClick={exportCsv}
            title={t("list.exportHint")}><FileOutput className="size-4" /> {tc("actions.export")}</Button>
        </div>
        <div className="overflow-x-auto rounded-lg bg-background">
          <Table>
            <TableHeader><TableRow className={LIST_HEAD_ROW}>
              <TableHead className="pl-4">{t("cols.code")}</TableHead><TableHead>{t("cols.time")}</TableHead><TableHead>{t("cols.customer")}</TableHead>
              <TableHead className="text-right">{t("cols.subtotal")}</TableHead><TableHead className="text-right">{t("cols.total")}</TableHead>
              <TableHead className="text-right">{t("cols.paid")}</TableHead><TableHead className="pr-4">{t("cols.status")}</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {!!data?.items.length && <TableRow className="font-bold hover:bg-transparent">
                <TableCell colSpan={3} /><TableCell className="text-right">{formatMoney(data.sumSubtotal ?? 0)}</TableCell>
                <TableCell className="text-right">{formatMoney(data.sumTotal ?? 0)}</TableCell>
                <TableCell className="text-right">{formatMoney(data.sumDeposit ?? 0)}</TableCell><TableCell />
              </TableRow>}
              {data && !data.items.length && <ListEmptyRow cols={COLS} what={t("list.emptyWhat")}
                onWiden={filters.period.mode === "month" ? () => setFilters({ ...filters, period: { ...filters.period, mode: "all" } }) : undefined} />}
              {data?.items.map((o) => (
                <Fragment key={o.id}>
                  <TableRow className={cn("cursor-pointer", expanded === o.id && "bg-primary-tint hover:bg-primary-tint", o.status === "CANCELLED" && "text-muted-foreground")}
                    onClick={() => toggle(o.id)}>
                    <TableCell className="pl-4">{o.code}</TableCell><TableCell>{formatDateTime(o.orderedAt)}</TableCell>
                    <TableCell className="whitespace-normal">{o.customerName}</TableCell>
                    <TableCell className="text-right">{formatMoney(o.subtotal)}</TableCell><TableCell className="text-right">{formatMoney(o.total)}</TableCell>
                    <TableCell className="text-right">{formatMoney(o.deposit)}</TableCell>
                    <TableCell className="pr-4"><StatusBadge tone={ORDER_STATUS_TONE[o.status]}>{t(ORDER_STATUS_KEY[o.status])}</StatusBadge></TableCell>
                  </TableRow>
                  {expanded === o.id && <TableRow className="hover:bg-transparent"><TableCell colSpan={COLS} className="p-0 whitespace-normal"><OrderDetailPanel id={o.id} onClose={() => setExpanded(null)} /></TableCell></TableRow>}
                </Fragment>))}
            </TableBody>
          </Table>
        </div>
        <ListPager total={data?.total ?? 0} page={page} size={size} unit={t("list.unit")} onPage={setPage} onSize={(s) => { setSize(s); setPage(0); }} />
      </div>
    </div>
  );
}

export default function Page() {
  return <DeepLinkRoute>{(link) => <OrdersPage link={link} />}</DeepLinkRoute>;
}
