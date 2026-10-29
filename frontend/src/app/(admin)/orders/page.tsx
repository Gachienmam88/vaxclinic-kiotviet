"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { ListEmptyRow } from "@/components/ui/list-empty-state";
import { DeepLinkRoute, useDeepLinkExpanded, type DeepLink } from "@/components/ui/deep-link-route";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSalesChannels } from "@/features/delivery/delivery-queries";
import { useShownColumns } from "@/features/delivery/delivery-list-toolbar";
import { OrderDetailPanel } from "@/features/orders/order-detail-panel";
import { DEFAULT_ORDER_FILTERS, OrderFilterSidebar, type OrderFilters } from "@/features/orders/order-filter-sidebar";
import { DEFAULT_ORDER_COLUMNS, ORDER_COLUMNS, ORDER_MONEY, orderCell } from "@/features/orders/order-list-columns";
import { OrderListToolbar } from "@/features/orders/order-list-toolbar";
import { OrderMergeDialog } from "@/features/orders/order-merge-dialog";
import { useOrders } from "@/features/orders/order-queries";
import { EMPTY_ORDER_SEARCH, OrderSearchPanel, type OrderSearch } from "@/features/orders/order-search-panel";
import { exportOrderDetail, exportOrderOverview } from "@/features/orders/order-xlsx-export";
import { LIST_HEAD_ROW, PageTitle } from "@/features/sales/invoice-list-kit";
import { ListPager } from "@/features/sales/invoice-list-pager";
import { periodParams } from "@/features/sales/sales-queries";
import { errorMessage } from "@/lib/api-client";
import { formatMoney } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { useCurrentUser } from "@/lib/use-current-user";
import { cn } from "@/lib/utils";
import { ordersNs } from "@/messages/orders";

const FAV_KEY = "orders.favourites";
const SUM: Partial<Record<string, "sumSubtotal" | "sumTotal" | "sumDeposit">> = { subtotal: "sumSubtotal", total: "sumTotal", deposit: "sumDeposit" };

/** Đánh dấu ☆ (KiotViet): lưu theo trình duyệt người xem. */
function useFavourites() {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => { try { setIds(JSON.parse(window.localStorage.getItem(FAV_KEY) ?? "[]")); } catch { /* mặc định rỗng */ } }, []);
  const toggle = (id: string) => setIds((prev) => {
    const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
    try { window.localStorage.setItem(FAV_KEY, JSON.stringify(next)); } catch { /* bỏ qua */ }
    return next;
  });
  return { has: (id: string) => ids.includes(id), toggle };
}

/**
 * Đặt hàng (KiotViet): tìm theo mã phiếu đặt (+ khung tìm theo hàng / khách), lọc trái, chọn cột, xuất file tổng quan / chi tiết,
 * dòng tổng, chi tiết mở dưới dòng. Tạo đơn ở màn bán hàng (/sale?newOrder=1). Link sâu ?code=DH000001 hoặc ?id=.
 */
function OrdersPage({ link }: { link: DeepLink }) {
  const t = useT(ordersNs);
  const { can, data: me } = useCurrentUser();
  const [merging, setMerging] = useState(false);
  const deepLink = !!(link.code || link.id);
  const [search, setSearch] = useState<OrderSearch>({ ...EMPTY_ORDER_SEARCH, q: link.code ?? "" });
  const [q, setQ] = useState(search);
  const [filters, setFilters] = useState<OrderFilters>(deepLink
    ? { ...DEFAULT_ORDER_FILTERS, period: { mode: "all", from: "", to: "" }, statuses: ["DRAFT", "CONFIRMED", "COMPLETED", "CANCELLED"] }
    : DEFAULT_ORDER_FILTERS);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(15);
  useEffect(() => { const h = setTimeout(() => { setQ(search); setPage(0); }, 300); return () => clearTimeout(h); }, [search]);
  const cols = useShownColumns("orders.columns", DEFAULT_ORDER_COLUMNS);
  const fav = useFavourites();
  const { data: channels = [] } = useSalesChannels();
  const channel = (c: string) => channels.find((x) => x.code === c)?.name ?? c;

  const params = useMemo(() => {
    const p = periodParams(filters.period, new URLSearchParams({ page: String(page), size: String(size) }));
    periodParams(filters.delivery, p, "deliveryFrom", "deliveryTo");
    (["q", "productQ", "customerQ"] as const).forEach((k) => { if (q[k].trim()) p.set(k, q[k].trim()); });
    filters.statuses.forEach((s) => p.append("statuses", s));
    filters.funds.forEach((f) => p.append("paymentMethods", f));
    filters.areas.forEach((a) => p.append("areas", a));
    if (filters.channel) p.set("channels", filters.channel);
    if (filters.createdBy) p.set("createdBy", filters.createdBy);
    if (filters.sellerId) p.set("sellerId", filters.sellerId);
    return p;
  }, [q, filters, page, size]);
  const { data } = useOrders(params);
  const { open: expanded, setOpen: setExpanded, toggle } = useDeepLinkExpanded(data?.items, link, (o) => [o.code]);
  const shown = ORDER_COLUMNS.filter(cols.shown);
  const span = shown.length + 2;

  const exportFile = async (kind: "overview" | "detail") => {
    const id = toast.loading(t("kv.exporting"));
    try {
      const { name, blob } = kind === "overview" ? await exportOrderOverview(t, params, cols.shown, channel) : await exportOrderDetail(t, params, channel);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.dismiss(id);
    } catch (e) { toast.error(errorMessage(e), { id }); }
  };

  return (
    <div className="flex gap-2.5">
      <div className="space-y-3">
        <PageTitle>{t("kv.title")}</PageTitle>
        <OrderFilterSidebar value={filters} onChange={(f) => { setFilters(f); setPage(0); }} />
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex items-center gap-2">
          <OrderSearchPanel value={search} onChange={setSearch} />
          <OrderListToolbar canOrder={can("sales.perform")} onMerge={() => setMerging(true)} exportDisabled={!data?.items.length} onExport={exportFile}
            shown={cols.shown} onToggle={cols.toggle} />
        </div>
        <div className="overflow-x-auto rounded-lg bg-background">
          <Table stickyHeader>
            <TableHeader><TableRow className={LIST_HEAD_ROW}>
              <TableHead className="w-9 pl-4" aria-label={t("kv.favourite")}><Star className="size-4" /></TableHead>
              <TableHead>{t("cols.code")}</TableHead>
              {shown.map((c) => <TableHead key={c} className={cn(ORDER_MONEY.has(c) && "text-right", c === shown.at(-1) && "pr-4")}>{t(`kv.cols.${c}`)}</TableHead>)}
            </TableRow></TableHeader>
            <TableBody>
              {!!data?.items.length && <TableRow className="font-bold hover:bg-transparent">
                <TableCell colSpan={2} />
                {shown.map((c) => <TableCell key={c} className="text-right">{SUM[c] ? formatMoney(data[SUM[c]!] ?? 0) : ""}</TableCell>)}
              </TableRow>}
              {data && !data.items.length && <ListEmptyRow cols={span} what={t("kv.emptyWhat")}
                onWiden={filters.period.mode !== "all" ? () => setFilters({ ...filters, period: { mode: "all", from: "", to: "" } }) : undefined} />}
              {data?.items.map((o) => (
                <Fragment key={o.id}>
                  <TableRow className={cn("cursor-pointer", expanded === o.id && "bg-primary-tint hover:bg-primary-tint")} onClick={() => toggle(o.id)}>
                    <TableCell className="pl-4"><button type="button" aria-label={t("kv.favourite")} aria-pressed={fav.has(o.id)}
                      onClick={(e) => { e.stopPropagation(); fav.toggle(o.id); }}>
                      <Star className={cn("size-4", fav.has(o.id) ? "fill-amber-400 text-amber-400" : "text-muted-foreground")} /></button></TableCell>
                    <TableCell>{o.code}</TableCell>
                    {shown.map((c) => <TableCell key={c} className={cn(ORDER_MONEY.has(c) && "text-right", c === "customer" && "whitespace-normal")}
                      onClick={c === "customerCode" || c === "invoiceCode" ? (e) => e.stopPropagation() : undefined}>{orderCell(t, o, c, channel)}</TableCell>)}
                  </TableRow>
                  {expanded === o.id && <TableRow className="hover:bg-transparent"><TableCell colSpan={span} className="p-0 whitespace-normal">
                    <OrderDetailPanel id={o.id} onClose={() => setExpanded(null)} /></TableCell></TableRow>}
                </Fragment>))}
            </TableBody>
          </Table>
        </div>
        <ListPager total={data?.total ?? 0} page={page} size={size} unit={t("list.unit")} onPage={setPage} onSize={(s) => { setSize(s); setPage(0); }} />
      </div>
      {merging && <OrderMergeDialog branchId={me?.user.branches[0]?.id ?? ""} onClose={() => setMerging(false)} />}
    </div>
  );
}

export default function Page() {
  return <DeepLinkRoute>{(link) => <OrdersPage link={link} />}</DeepLinkRoute>;
}
