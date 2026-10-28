"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { NativeSelect } from "@/features/products/product-form-sections";
import { useUserLookup } from "@/features/purchases/purchase-queries";
import { CashVoucherDetail } from "@/features/sales/cash-voucher-detail";
import { CashVoucherDialog } from "@/features/sales/cash-voucher-dialog";
import { periodParams, useCashbook, useCashCategories, type Period } from "@/features/sales/sales-queries";
import { FUND_LABEL } from "@/features/sales/sales-types";
import { formatDateTime, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function CashbookPage() {
  const { data: users = [] } = useUserLookup();
  const { data: categories = [] } = useCashCategories();
  const [fund, setFund] = useState("CASH");
  const [period, setPeriod] = useState<Period>({ mode: "month", from: "", to: "" });
  const [types, setTypes] = useState<string[]>([]);
  const [category, setCategory] = useState("");
  const [statuses, setStatuses] = useState<string[]>(["PAID"]);
  const [accounting, setAccounting] = useState("");
  const [createdBy, setCreatedBy] = useState("");
  const [partner, setPartner] = useState("");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"RECEIPT" | "PAYMENT" | null>(null);
  useEffect(() => { const t = setTimeout(() => { setQ(search); setPage(0); }, 300); return () => clearTimeout(t); }, [search]);

  const params = useMemo(() => {
    const p = periodParams(period, new URLSearchParams({ fund, page: String(page), size: "15" }));
    types.forEach((t) => p.append("voucherTypes", t));
    statuses.forEach((s) => p.append("statuses", s));
    if (category) p.set("category", category);
    if (accounting) p.set("accounting", accounting);
    if (createdBy) p.set("createdBy", createdBy);
    if (partner) p.set("partner", partner);
    if (q) p.set("q", q);
    return p;
  }, [fund, period, types, statuses, category, accounting, createdBy, partner, q, page]);
  const { data } = useCashbook(params);
  const pages = data ? Math.max(1, Math.ceil(data.total / 15)) : 1;
  const toggle = (list: string[], v: string, on: boolean) => (on ? [...list, v] : list.filter((x) => x !== v));
  const s = data?.summary;

  return (
    <div className="flex gap-4">
      <div className="space-y-4">
        <h1 className="text-xl font-bold">Sổ quỹ {FUND_LABEL[fund].toLowerCase()}</h1>
        <aside className="w-60 space-y-4 rounded-lg bg-background p-4 text-sm">
          <div className="space-y-1.5"><b>Quỹ tiền</b>
            {["CASH", "BANK", "EWALLET", "ALL"].map((f) => (
              <label key={f} className="flex items-center gap-2"><input type="radio" className="accent-primary" checked={fund === f}
                onChange={() => { setFund(f); setPage(0); }} />{FUND_LABEL[f]}</label>))}</div>
          <div className="space-y-1.5"><b>Thời gian</b>
            {(["month", "custom"] as const).map((m) => (
              <label key={m} className="flex items-center gap-2"><input type="radio" className="accent-primary" checked={period.mode === m}
                onChange={() => { setPeriod({ ...period, mode: m }); setPage(0); }} />{m === "month" ? "Tháng này" : "Tùy chỉnh"}</label>))}
            {period.mode === "custom" && <>
              <Input type="date" value={period.from} onChange={(e) => setPeriod({ ...period, from: e.target.value })} />
              <Input type="date" value={period.to} onChange={(e) => setPeriod({ ...period, to: e.target.value })} /></>}</div>
          <div className="space-y-1.5"><b>Loại chứng từ</b>
            {([["RECEIPT", "Phiếu thu"], ["PAYMENT", "Phiếu chi"]] as const).map(([v, l]) => (
              <label key={v} className="flex items-center gap-2"><Checkbox checked={types.includes(v)}
                onCheckedChange={(on) => { setTypes(toggle(types, v, on === true)); setPage(0); }} />{l}</label>))}</div>
          <div className="space-y-1.5"><b>Loại thu chi</b>
            <NativeSelect value={category} onChange={(e) => { setCategory(e.target.value); setPage(0); }}>
              <option value="">Chọn loại thu chi</option>{categories.map((c) => <option key={c}>{c}</option>)}</NativeSelect></div>
          <div className="space-y-1.5"><b>Trạng thái</b>
            {([["PAID", "Đã thanh toán"], ["CANCELLED", "Đã hủy"]] as const).map(([v, l]) => (
              <label key={v} className="flex items-center gap-2"><Checkbox checked={statuses.includes(v)}
                onCheckedChange={(on) => { setStatuses(toggle(statuses, v, on === true)); setPage(0); }} />{l}</label>))}</div>
          <div className="space-y-1.5"><b>Hạch toán kết quả kinh doanh</b>
            <NativeSelect value={accounting} onChange={(e) => { setAccounting(e.target.value); setPage(0); }}>
              <option value="">Tất cả</option><option value="true">Có</option><option value="false">Không</option></NativeSelect></div>
          <div className="space-y-1.5"><b>Người tạo</b>
            <NativeSelect value={createdBy} onChange={(e) => { setCreatedBy(e.target.value); setPage(0); }}>
              <option value="">Chọn người tạo</option>{users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}</NativeSelect></div>
          <div className="space-y-1.5"><b>Người nộp/nhận</b>
            <Input placeholder="Tên hoặc số điện thoại" value={partner} onChange={(e) => { setPartner(e.target.value); setPage(0); }} /></div>
        </aside>
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative w-full max-w-md">
            <Search className="absolute top-2 left-2.5 size-4 text-muted-foreground" />
            <Input className="bg-background pl-8" placeholder="Theo mã phiếu" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Button variant="outline" className="ml-auto border-primary text-primary" onClick={() => setDialog("RECEIPT")}><Plus className="size-4" /> Phiếu thu</Button>
          <Button variant="outline" className="border-primary text-primary" onClick={() => setDialog("PAYMENT")}><Plus className="size-4" /> Phiếu chi</Button>
        </div>
        <div className="grid grid-cols-4 gap-4 rounded-lg bg-background p-4 text-right">
          {([["Quỹ đầu kỳ", s?.opening, ""], ["Tổng thu", s?.receipts, "text-primary"], ["Tổng chi", s ? -s.payments : 0, "text-destructive"],
            ["Tồn quỹ", s?.closing, "text-green-600"]] as const).map(([l, v, c]) => (
            <div key={l}><div className="text-sm text-muted-foreground">{l}</div><div className={cn("text-lg font-bold", c)}>{formatMoney(v ?? 0)}</div></div>))}
        </div>
        <div className="overflow-x-auto rounded-lg bg-background">
          <Table>
            <TableHeader><TableRow className="bg-primary/10 hover:bg-primary/10">
              <TableHead>Mã phiếu</TableHead><TableHead>Thời gian</TableHead><TableHead>Loại thu chi</TableHead>
              <TableHead>Người nộp/nhận</TableHead><TableHead className="text-right">Giá trị</TableHead></TableRow></TableHeader>
            <TableBody>
              {data && !data.items.length && <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">Không có phiếu nào phù hợp</TableCell></TableRow>}
              {data?.items.map((v) => (
                <Fragment key={v.id}>
                  <TableRow className={cn("cursor-pointer", expanded === v.id && "bg-primary/5", v.status === "CANCELLED" && "text-muted-foreground line-through")}
                    onClick={() => setExpanded(expanded === v.id ? null : v.id)}>
                    <TableCell className="font-medium">{v.code}</TableCell><TableCell>{formatDateTime(v.occurredAt)}</TableCell>
                    <TableCell>{v.category}</TableCell><TableCell>{v.partnerName}</TableCell>
                    <TableCell className="text-right">{formatMoney(v.voucherType === "PAYMENT" ? -v.amount : v.amount)}</TableCell>
                  </TableRow>
                  {expanded === v.id && <TableRow className="hover:bg-transparent"><TableCell colSpan={5} className="p-0 whitespace-normal"><CashVoucherDetail id={v.id} /></TableCell></TableRow>}
                </Fragment>))}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-end gap-2 text-sm">
          <span className="text-muted-foreground">{data?.total ?? 0} phiếu — trang {page + 1}/{pages}</span>
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Trước</Button>
          <Button size="sm" variant="outline" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Sau</Button>
        </div>
      </div>
      {dialog && <CashVoucherDialog type={dialog} onClose={() => setDialog(null)} />}
    </div>
  );
}
