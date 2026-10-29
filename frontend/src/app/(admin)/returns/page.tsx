"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SlidersHorizontal } from "lucide-react";
import { DeepLinkRoute, type DeepLink } from "@/components/ui/deep-link-route";
import { useShownColumns } from "@/features/delivery/delivery-list-toolbar";
import { DEFAULT_RETURN_COLUMNS } from "@/features/returns/return-list-columns";
import { DEFAULT_RETURN_FILTERS, ReturnFilterSidebar, type ReturnFilters } from "@/features/returns/return-filter-sidebar";
import { ReturnListTable, type ReturnPage } from "@/features/returns/return-list-table";
import { ReturnListToolbar } from "@/features/returns/return-list-toolbar";
import { exportReturnDetail, exportReturnOverview } from "@/features/returns/return-xlsx-export";
import { FileJobsPanel, useFileJobs } from "@/features/sales/invoice-file-jobs-panel";
import { ListSearch, PageTitle } from "@/features/sales/invoice-list-kit";
import { ListPager } from "@/features/sales/invoice-list-pager";
import { periodParams } from "@/features/sales/sales-queries";
import { useBranches } from "@/features/settings/settings-queries";
import { api } from "@/lib/api-client";
import { useT } from "@/lib/i18n";
import { useCurrentUser } from "@/lib/use-current-user";
import { deliveryNs } from "@/messages/delivery";
import { salesNs } from "@/messages/sales";

/** ☆ đánh dấu phiếu trả, lưu theo người dùng trên máy này. */
function useReturnFavourites(userId: string | undefined) {
  const key = userId ? `kv.returns.favourites.${userId}` : null;
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => { try { if (key) setIds(JSON.parse(localStorage.getItem(key) ?? "[]")); } catch { /* bỏ qua */ } }, [key]);
  const toggle = (id: string) => {
    const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
    setIds(next);
    try { if (key) localStorage.setItem(key, JSON.stringify(next)); } catch { /* bỏ qua */ }
  };
  return { isFav: (id: string) => ids.includes(id), toggle };
}

/**
 * Đơn hàng → Trả hàng (KiotViet): tìm "Theo mã phiếu trả", + Trả hàng, Xuất file (tổng quan / chi tiết, chạy nền), chọn cột,
 * thiết lập, hướng dẫn; lọc loại / trạng thái / giao hàng / đối tác / thời gian. Link sâu ?code=TH000001 mở chi tiết.
 */
function SalesReturnsPage({ link }: { link: DeepLink }) {
  const t = useT(salesNs);
  const td = useT(deliveryNs);
  const { data: me, can } = useCurrentUser();
  const { data: branches = [] } = useBranches();
  const deep = !!(link.code || link.id);
  const [search, setSearch] = useState(link.code ?? "");
  const [q, setQ] = useState(link.code ?? "");
  const [filters, setFiltersRaw] = useState<ReturnFilters>(deep
    ? { ...DEFAULT_RETURN_FILTERS, period: { mode: "all", from: "", to: "" }, statuses: [] } : DEFAULT_RETURN_FILTERS);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(15);
  const [selected, setSelected] = useState<string[]>([]);
  const cols = useShownColumns("kv.returns.columns", DEFAULT_RETURN_COLUMNS);
  const fav = useReturnFavourites(me?.user.id);
  const jobs = useFileJobs();
  useEffect(() => { const h = setTimeout(() => { setQ(search); setPage(0); }, 300); return () => clearTimeout(h); }, [search]);
  const setFilters = (f: ReturnFilters) => { setFiltersRaw(f); setPage(0); setSelected([]); };
  const params = useMemo(() => {
    const p = periodParams(filters.period, new URLSearchParams({ page: String(page), size: String(size) }));
    if (q) p.set("q", q);
    filters.statuses.forEach((s) => p.append("statuses", s));
    // Chọn đủ 3 loại = không lọc loại; bỏ hết = không có phiếu nào
    if (filters.types.length < 3) (filters.types.length ? filters.types : ["NONE"]).forEach((s) => p.append("types", s));
    filters.deliveryStatuses.forEach((s) => p.append("deliveryStatuses", s));
    if (filters.partnerId) p.set("partnerId", filters.partnerId);
    return p;
  }, [q, filters, page, size]);
  const { data } = useQuery({ queryKey: ["sales-returns", params.toString()], queryFn: () => api<ReturnPage>(`/sales-returns?${params}`),
    placeholderData: (prev) => prev });
  const branch = (id: string) => branches.find((b) => b.id === id)?.name ?? "";
  const onExport = (kind: "overview" | "detail") => jobs.run(t("returns.kv.exporting"), () => kind === "overview"
    ? exportReturnOverview(t, td, params, cols.shown, branch) : exportReturnDetail(t, td, params, branch));

  return (
    <div className="flex gap-2.5">
      <div className="space-y-3">
        <PageTitle>{t("returns.title")}</PageTitle>
        <ReturnFilterSidebar value={filters} onChange={setFilters} />
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative"><ListSearch value={search} onChange={setSearch} placeholder={t("returns.kv.search")} />
            <SlidersHorizontal className="pointer-events-none absolute top-2 right-2.5 size-4 text-muted-foreground" aria-hidden /></div>
          <ReturnListToolbar canReturn={can("sales.perform")} exportDisabled={!data?.items.length} onExport={onExport} shown={cols.shown} onToggle={cols.toggle} />
        </div>
        <ReturnListTable data={data} shown={cols.shown} link={link} selected={selected} onSelect={setSelected} fav={fav}
          onWiden={filters.period.mode !== "all" ? () => setFilters({ ...filters, period: { ...filters.period, mode: "all" } }) : undefined} />
        <ListPager total={data?.total ?? 0} page={page} size={size} unit={t("returns.unit")} onPage={setPage} onSize={(s) => { setSize(s); setPage(0); }} />
      </div>
      <FileJobsPanel jobs={jobs.jobs} onClose={jobs.clear} />
    </div>
  );
}

export default function Page() {
  return <DeepLinkRoute>{(link) => <SalesReturnsPage link={link} />}</DeepLinkRoute>;
}
