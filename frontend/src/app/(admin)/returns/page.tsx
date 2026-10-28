"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileOutput } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ListEmptyRow } from "@/components/ui/list-empty-state";
import { DocCodeLink } from "@/components/ui/doc-code-link";
import { DeepLinkRoute, useDeepLinkExpanded, type DeepLink } from "@/components/ui/deep-link-route";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  CheckOption, FilterSection, FilterSidebar, LIST_HEAD_ROW, ListSearch, PageTitle, PeriodFilter, StatusBadge, TOOLBAR_BTN,
} from "@/features/sales/invoice-list-kit";
import { downloadCsv, ListPager } from "@/features/sales/invoice-list-pager";
import { periodParams, type Period } from "@/features/sales/sales-queries";
import { api } from "@/lib/api-client";
import { formatDateTime, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SalesReturnDetailPanel, type SalesReturnItem } from "./sales-return-detail-panel";

const COLS = 9;
const STATUSES = [["COMPLETED", "Đã trả"], ["CANCELLED", "Đã hủy"]] as const;

/**
 * Đơn hàng → Trả hàng: danh sách phiếu khách trả hàng. Tạo phiếu từ nút "Trả hàng" trong chi tiết hóa đơn.
 * Link sâu: /returns?code=TH000001 (lọc theo mã, mọi thời gian, mở chi tiết) hoặc ?id=<uuid>.
 */
function SalesReturnsPage({ link }: { link: DeepLink }) {
  const [search, setSearch] = useState(link.code ?? "");
  const [q, setQ] = useState(link.code ?? "");
  const [period, setPeriod] = useState<Period>({ mode: link.code || link.id ? "all" : "month", from: "", to: "" });
  const [statuses, setStatuses] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(15);
  useEffect(() => { const t = setTimeout(() => { setQ(search); setPage(0); }, 300); return () => clearTimeout(t); }, [search]);
  const params = useMemo(() => {
    const p = periodParams(period, new URLSearchParams({ page: String(page), size: String(size) }));
    if (q) p.set("q", q);
    statuses.forEach((s) => p.append("statuses", s));
    return p;
  }, [q, period, statuses, page, size]);
  const { data } = useQuery({
    queryKey: ["sales-returns", params.toString()],
    queryFn: () => api<{ items: SalesReturnItem[]; total: number; sumTotal: number }>(`/sales-returns?${params}`),
    placeholderData: (prev) => prev,
  });
  const { open: expanded, setOpen: setExpanded, toggle: toggleRow } = useDeepLinkExpanded(data?.items, link, (r) => [r.code]);
  const toggle = (v: string, on: boolean) => { setStatuses(on ? [...statuses, v] : statuses.filter((x) => x !== v)); setPage(0); };
  const exportCsv = () => downloadCsv("tra-hang", ["Mã trả hàng", "Thời gian", "Mã hóa đơn", "Khách hàng", "Tổng tiền hàng", "Phí trả hàng",
    "Cần trả khách", "Đã trả khách", "Trạng thái"], (data?.items ?? []).map((r) => [r.code, formatDateTime(r.returnedAt), r.invoiceCode,
    r.customerName, r.subtotal, r.fee, r.total, r.refunded, r.status === "COMPLETED" ? "Đã trả" : "Đã hủy"]));

  return (
    <div className="flex gap-2.5">
      <div className="space-y-3">
        <PageTitle>Trả hàng</PageTitle>
        <FilterSidebar>
          <PeriodFilter allowAll value={period} onChange={(p) => { setPeriod(p); setPage(0); }} />
          <FilterSection title="Trạng thái">
            {STATUSES.map(([v, l]) => <CheckOption key={v} checked={statuses.includes(v)} onChange={(on) => toggle(v, on)}>{l}</CheckOption>)}
          </FilterSection>
        </FilterSidebar>
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex items-center gap-2">
          <ListSearch value={search} onChange={setSearch} placeholder="Theo mã phiếu trả, mã hóa đơn, tên khách" />
          <Button variant="outline" className={cn(TOOLBAR_BTN, "ml-auto")} disabled={!data?.items.length} onClick={exportCsv}
            title="Xuất các dòng đang hiển thị ra file CSV"><FileOutput className="size-4" /> Xuất file</Button>
        </div>
        <div className="overflow-x-auto rounded-lg bg-background">
          <Table>
            <TableHeader><TableRow className={LIST_HEAD_ROW}>
              <TableHead className="pl-4">Mã trả hàng</TableHead><TableHead>Thời gian</TableHead><TableHead>Mã hóa đơn</TableHead><TableHead>Khách hàng</TableHead>
              <TableHead className="text-right">Tổng tiền hàng</TableHead><TableHead className="text-right">Phí trả hàng</TableHead>
              <TableHead className="text-right">Cần trả khách</TableHead><TableHead className="text-right">Đã trả khách</TableHead><TableHead className="pr-4">Trạng thái</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {!!data?.items.length && <TableRow className="font-bold hover:bg-transparent">
                <TableCell colSpan={6} /><TableCell className="text-right">{formatMoney(data.sumTotal ?? 0)}</TableCell><TableCell colSpan={2} />
              </TableRow>}
              {data && !data.items.length && <ListEmptyRow cols={COLS} what="phiếu trả hàng"
                onWiden={period.mode === "month" ? () => { setPeriod({ ...period, mode: "all" }); setPage(0); } : undefined} />}
              {data?.items.map((r) => (
                <Fragment key={r.id}>
                  <TableRow className={cn("cursor-pointer", expanded === r.id && "bg-primary-tint hover:bg-primary-tint")} onClick={() => toggleRow(r.id)}>
                    <TableCell className="pl-4">{r.code}</TableCell><TableCell>{formatDateTime(r.returnedAt)}</TableCell>
                    <TableCell><DocCodeLink code={r.invoiceCode} /></TableCell><TableCell className="whitespace-normal">{r.customerName}</TableCell>
                    <TableCell className="text-right">{formatMoney(r.subtotal)}</TableCell><TableCell className="text-right">{formatMoney(r.fee)}</TableCell>
                    <TableCell className="text-right">{formatMoney(r.total)}</TableCell><TableCell className="text-right">{formatMoney(r.refunded)}</TableCell>
                    <TableCell className="pr-4"><StatusBadge tone={r.status === "COMPLETED" ? "green" : "red"}>{r.status === "COMPLETED" ? "Đã trả" : "Đã hủy"}</StatusBadge></TableCell>
                  </TableRow>
                  {expanded === r.id && <TableRow className="hover:bg-transparent"><TableCell colSpan={COLS} className="p-0 whitespace-normal"><SalesReturnDetailPanel id={r.id} onClose={() => setExpanded(null)} /></TableCell></TableRow>}
                </Fragment>))}
            </TableBody>
          </Table>
        </div>
        <ListPager total={data?.total ?? 0} page={page} size={size} unit="phiếu" onPage={setPage} onSize={(s) => { setSize(s); setPage(0); }} />
      </div>
    </div>
  );
}

export default function Page() {
  return <DeepLinkRoute>{(link) => <SalesReturnsPage link={link} />}</DeepLinkRoute>;
}
