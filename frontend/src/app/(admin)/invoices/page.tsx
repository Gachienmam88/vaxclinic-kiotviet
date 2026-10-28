"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { NativeSelect } from "@/features/products/product-form-sections";
import { useUserLookup } from "@/features/purchases/purchase-queries";
import { InvoiceDetailPanel } from "@/features/sales/invoice-detail-panel";
import { periodParams, useInvoices, type Period } from "@/features/sales/sales-queries";
import { PAYMENT_METHODS, methodLabel } from "@/features/sales/sales-types";
import { formatDateTime, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

const COLS = 9;

export default function InvoicesPage() {
  const { data: users = [] } = useUserLookup();
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [period, setPeriod] = useState<Period>({ mode: "month", from: "", to: "" });
  const [statuses, setStatuses] = useState<string[]>(["COMPLETED"]);
  const [methods, setMethods] = useState<string[]>([]);
  const [createdBy, setCreatedBy] = useState("");
  const [sellerId, setSellerId] = useState("");
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  useEffect(() => { const t = setTimeout(() => { setQ(search); setPage(0); }, 300); return () => clearTimeout(t); }, [search]);

  const params = useMemo(() => {
    const p = periodParams(period, new URLSearchParams({ page: String(page), size: "15" }));
    if (q) p.set("q", q);
    statuses.forEach((s) => p.append("statuses", s));
    methods.forEach((m) => p.append("paymentMethods", m));
    if (createdBy) p.set("createdBy", createdBy);
    if (sellerId) p.set("sellerId", sellerId);
    return p;
  }, [q, period, statuses, methods, createdBy, sellerId, page]);
  const { data } = useInvoices(params);
  const pages = data ? Math.max(1, Math.ceil(data.total / 15)) : 1;
  const toggle = (list: string[], v: string, on: boolean) => (on ? [...list, v] : list.filter((x) => x !== v));

  return (
    <div className="flex gap-4">
      <div className="space-y-4">
        <h1 className="text-xl font-bold">Hóa đơn</h1>
        <aside className="w-60 space-y-4 rounded-lg bg-background p-4 text-sm">
          <div className="space-y-1.5"><b>Thời gian</b>
            {(["month", "custom"] as const).map((m) => (
              <label key={m} className="flex items-center gap-2"><input type="radio" className="accent-primary" checked={period.mode === m}
                onChange={() => { setPeriod({ ...period, mode: m }); setPage(0); }} />{m === "month" ? "Tháng này" : "Tùy chỉnh"}</label>))}
            {period.mode === "custom" && <>
              <Input type="date" value={period.from} onChange={(e) => setPeriod({ ...period, from: e.target.value })} />
              <Input type="date" value={period.to} onChange={(e) => setPeriod({ ...period, to: e.target.value })} /></>}
          </div>
          <div className="space-y-1.5"><b>Trạng thái hóa đơn</b>
            {([["COMPLETED", "Hoàn thành"], ["CANCELLED", "Đã hủy"]] as const).map(([v, l]) => (
              <label key={v} className="flex items-center gap-2"><Checkbox checked={statuses.includes(v)}
                onCheckedChange={(on) => { setStatuses(toggle(statuses, v, on === true)); setPage(0); }} />{l}</label>))}
          </div>
          <div className="space-y-1.5"><b>Phương thức thanh toán</b>
            {PAYMENT_METHODS.map((m) => (
              <label key={m.value} className="flex items-center gap-2"><Checkbox checked={methods.includes(m.value)}
                onCheckedChange={(on) => { setMethods(toggle(methods, m.value, on === true)); setPage(0); }} />{m.label}</label>))}
          </div>
          <div className="space-y-1.5"><b>Người tạo</b>
            <NativeSelect value={createdBy} onChange={(e) => { setCreatedBy(e.target.value); setPage(0); }}>
              <option value="">Chọn người tạo</option>{users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}</NativeSelect></div>
          <div className="space-y-1.5"><b>Người bán</b>
            <NativeSelect value={sellerId} onChange={(e) => { setSellerId(e.target.value); setPage(0); }}>
              <option value="">Chọn người bán</option>{users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}</NativeSelect></div>
        </aside>
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative w-full max-w-md">
            <Search className="absolute top-2 left-2.5 size-4 text-muted-foreground" />
            <Input className="bg-background pl-8" placeholder="Theo mã hóa đơn, tên / mã / SĐT khách" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Button className="ml-auto" render={<Link href="/pos" />}><Plus className="size-4" /> Tạo mới</Button>
        </div>
        <div className="overflow-x-auto rounded-lg bg-background">
          <Table>
            <TableHeader><TableRow className="bg-primary/10 hover:bg-primary/10">
              <TableHead>Mã hóa đơn</TableHead><TableHead>Thời gian</TableHead><TableHead>Mã KH</TableHead><TableHead>Khách hàng</TableHead>
              <TableHead className="text-right">Tổng tiền hàng</TableHead><TableHead className="text-right">Giảm giá</TableHead>
              <TableHead className="text-right">Khách cần trả</TableHead><TableHead className="text-right">Khách đã trả</TableHead><TableHead>Thanh toán</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              <TableRow className="font-semibold hover:bg-transparent">
                <TableCell colSpan={4} /><TableCell className="text-right">{formatMoney(data?.sumSubtotal ?? 0)}</TableCell>
                <TableCell className="text-right">{formatMoney(data?.sumDiscount ?? 0)}</TableCell>
                <TableCell className="text-right">{formatMoney(data?.sumTotal ?? 0)}</TableCell>
                <TableCell className="text-right">{formatMoney(data?.sumPaid ?? 0)}</TableCell><TableCell />
              </TableRow>
              {data && !data.items.length && <TableRow><TableCell colSpan={COLS} className="py-10 text-center text-muted-foreground">Không tìm thấy hóa đơn nào phù hợp</TableCell></TableRow>}
              {data?.items.map((i) => (
                <Fragment key={i.id}>
                  <TableRow className={cn("cursor-pointer", expanded === i.id && "bg-primary/5", i.status === "CANCELLED" && "text-muted-foreground")}
                    onClick={() => setExpanded(expanded === i.id ? null : i.id)}>
                    <TableCell className="font-medium">{i.code}{i.status === "CANCELLED" && <Badge variant="destructive" className="ml-1">Hủy</Badge>}</TableCell>
                    <TableCell>{formatDateTime(i.soldAt)}</TableCell><TableCell>{i.customerCode}</TableCell><TableCell>{i.customerName}</TableCell>
                    <TableCell className="text-right">{formatMoney(i.subtotal)}</TableCell><TableCell className="text-right">{formatMoney(i.discount)}</TableCell>
                    <TableCell className="text-right">{formatMoney(i.total)}</TableCell><TableCell className="text-right">{formatMoney(i.paid)}</TableCell>
                    <TableCell>{methodLabel(i.paymentMethod)}</TableCell>
                  </TableRow>
                  {expanded === i.id && <TableRow className="hover:bg-transparent"><TableCell colSpan={COLS} className="p-0 whitespace-normal"><InvoiceDetailPanel id={i.id} /></TableCell></TableRow>}
                </Fragment>))}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-end gap-2 text-sm">
          <span className="text-muted-foreground">{data?.total ?? 0} hóa đơn — trang {page + 1}/{pages}</span>
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Trước</Button>
          <Button size="sm" variant="outline" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Sau</Button>
        </div>
      </div>
    </div>
  );
}
