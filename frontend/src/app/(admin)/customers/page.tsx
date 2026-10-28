"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CustomerDetailPanel } from "@/features/sales/customer-detail-panel";
import { CustomerFormDialog } from "@/features/sales/customer-form-dialog";
import { CustomerListFilterSidebar, type CustomerFilters } from "@/features/sales/customer-list-filter-sidebar";
import { periodParams, useCustomers } from "@/features/sales/sales-queries";
import { formatMoney } from "@/lib/format";
import { useCurrentUser } from "@/lib/use-current-user";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 15;
const COLS = 6;
const pagerBtn = "flex size-7 items-center justify-center rounded-md border border-[#d9dbe0] bg-white hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-40";

export default function CustomersPage() {
  const { data: me } = useCurrentUser();
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<CustomerFilters>({
    group: "", period: { mode: "all", from: "", to: "" }, createdBy: "", type: "", gender: "",
  });
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  useEffect(() => { const t = setTimeout(() => { setQ(search); setPage(0); }, 300); return () => clearTimeout(t); }, [search]);

  const params = useMemo(() => {
    const { group, period, createdBy, type, gender } = filters;
    const p = periodParams(period, new URLSearchParams({ page: String(page), size: String(PAGE_SIZE) }), "createdFrom", "createdTo");
    if (q) p.set("q", q);
    if (group) p.set("groupName", group);
    if (createdBy) p.set("createdBy", createdBy);
    if (type) p.set("customerType", type);
    if (gender) p.set("gender", gender);
    return p;
  }, [q, filters, page]);
  const { data } = useCustomers(params);
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="grid grid-cols-[200px_minmax(0,1fr)] gap-x-2.5 gap-y-2.5">
      <h1 className="flex h-8 items-center text-[18px] font-bold">Khách hàng</h1>
      <div className="flex h-8 items-center gap-2">
        <div className="relative h-[30px] w-[400px] max-w-full">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <input className="size-full rounded-md border border-[#d9dbe0] bg-white pr-2.5 pl-8 text-[13px] outline-none placeholder:text-muted-foreground focus:border-primary"
            placeholder="Theo mã, tên, số điện thoại" aria-label="Tìm khách hàng" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button type="button" onClick={() => setCreating(true)}
          className="ml-auto flex h-[30px] items-center gap-1 rounded-md border border-primary bg-white px-2.5 text-[13px] font-semibold text-primary hover:bg-primary/5">
          <Plus className="size-4" /> Khách hàng
        </button>
      </div>

      <CustomerListFilterSidebar value={filters} onChange={(v) => { setFilters(v); setPage(0); }} />

      <div className="min-w-0 space-y-2.5">
        <div className="overflow-hidden rounded-lg bg-white">
          <Table>
            <TableHeader><TableRow className="bg-[#e3f0fc] hover:bg-[#e3f0fc]">
              <TableHead className="pl-4">Mã khách hàng</TableHead><TableHead>Tên khách hàng</TableHead><TableHead>Điện thoại</TableHead>
              <TableHead className="text-right">Nợ hiện tại</TableHead><TableHead className="text-right">Tổng bán</TableHead>
              <TableHead className="pr-4 text-right">Tổng bán trừ trả hàng</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              <TableRow className="font-bold hover:bg-transparent">
                <TableCell colSpan={3} /><TableCell className="text-right">{formatMoney(data?.sumDebt ?? 0)}</TableCell>
                <TableCell className="text-right">{formatMoney(data?.sumSales ?? 0)}</TableCell>
                <TableCell className="pr-4 text-right">{formatMoney(data?.sumNetSales ?? 0)}</TableCell>
              </TableRow>
              {data && !data.items.length && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={COLS} className="py-10 text-center text-muted-foreground">Không tìm thấy khách hàng nào phù hợp</TableCell>
                </TableRow>
              )}
              {data?.items.map((c) => {
                const open = expanded === c.id;
                return (
                  <Fragment key={c.id}>
                    <TableRow aria-expanded={open} className={cn("cursor-pointer", open && "bg-[#e3f0fc] hover:bg-[#e3f0fc] font-semibold")}
                      onClick={() => setExpanded(open ? null : c.id)}>
                      <TableCell className="pl-4">{c.code}</TableCell><TableCell>{c.name}</TableCell><TableCell>{c.phone}</TableCell>
                      <TableCell className="text-right">{formatMoney(c.debt)}</TableCell>
                      <TableCell className="text-right">{formatMoney(c.totalSales)}</TableCell>
                      <TableCell className="pr-4 text-right">{formatMoney(c.netSales)}</TableCell>
                    </TableRow>
                    {open && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={COLS} className="p-0 whitespace-normal"><CustomerDetailPanel id={c.id} /></TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-end gap-2 text-[13px]">
          <span className="text-muted-foreground">{data?.total ?? 0} khách hàng · Trang {page + 1}/{pages}</span>
          <button type="button" className={pagerBtn} aria-label="Trang trước" disabled={page === 0} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="size-4" /></button>
          <button type="button" className={pagerBtn} aria-label="Trang sau" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>
            <ChevronRight className="size-4" /></button>
        </div>
      </div>
      {creating && <CustomerFormDialog branchId={me?.user.branches[0]?.id ?? ""} onClose={() => setCreating(false)} />}
    </div>
  );
}
