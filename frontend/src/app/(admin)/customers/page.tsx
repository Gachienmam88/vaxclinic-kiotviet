"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { NativeSelect } from "@/features/products/product-form-sections";
import { useUserLookup } from "@/features/purchases/purchase-queries";
import { CustomerDetailPanel } from "@/features/sales/customer-detail-panel";
import { CustomerFormDialog } from "@/features/sales/customer-form-dialog";
import { periodParams, useCustomerGroups, useCustomers, type Period } from "@/features/sales/sales-queries";
import { formatMoney } from "@/lib/format";
import { useCurrentUser } from "@/lib/use-current-user";
import { cn } from "@/lib/utils";

function Pills<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(([v, label]) => (
        <button key={v} type="button" onClick={() => onChange(v)} className={cn("rounded-full border px-3 py-1 text-sm",
          value === v ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted")}>{label}</button>
      ))}
    </div>
  );
}

export default function CustomersPage() {
  const { data: me } = useCurrentUser();
  const { data: groups = [] } = useCustomerGroups();
  const { data: users = [] } = useUserLookup();
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("");
  const [period, setPeriod] = useState<Period>({ mode: "all", from: "", to: "" });
  const [createdBy, setCreatedBy] = useState("");
  const [type, setType] = useState<"" | "PERSONAL" | "COMPANY">("");
  const [gender, setGender] = useState<"" | "MALE" | "FEMALE">("");
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  useEffect(() => { const t = setTimeout(() => { setQ(search); setPage(0); }, 300); return () => clearTimeout(t); }, [search]);

  const params = useMemo(() => {
    const p = periodParams(period, new URLSearchParams({ page: String(page), size: "15" }), "createdFrom", "createdTo");
    if (q) p.set("q", q);
    if (group) p.set("groupName", group);
    if (createdBy) p.set("createdBy", createdBy);
    if (type) p.set("customerType", type);
    if (gender) p.set("gender", gender);
    return p;
  }, [q, group, period, createdBy, type, gender, page]);
  const { data } = useCustomers(params);
  const pages = data ? Math.max(1, Math.ceil(data.total / 15)) : 1;
  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(0); };

  return (
    <div className="flex gap-4">
      <div className="space-y-4">
        <h1 className="text-xl font-bold">Khách hàng</h1>
        <aside className="w-60 space-y-4 rounded-lg bg-background p-4 text-sm">
          <div className="space-y-1.5"><b>Nhóm khách hàng</b>
            <NativeSelect value={group} onChange={(e) => reset(setGroup)(e.target.value)}>
              <option value="">Tất cả các nhóm</option>{groups.map((g) => <option key={g}>{g}</option>)}
            </NativeSelect></div>
          <div className="space-y-1.5"><b>Ngày tạo</b>
            {(["all", "custom"] as const).map((m) => (
              <label key={m} className="flex items-center gap-2"><input type="radio" className="accent-primary" checked={period.mode === m}
                onChange={() => reset(setPeriod)({ ...period, mode: m })} />{m === "all" ? "Toàn thời gian" : "Tùy chỉnh"}</label>
            ))}
            {period.mode === "custom" && <>
              <Input type="date" value={period.from} onChange={(e) => reset(setPeriod)({ ...period, from: e.target.value })} />
              <Input type="date" value={period.to} onChange={(e) => reset(setPeriod)({ ...period, to: e.target.value })} />
            </>}
          </div>
          <div className="space-y-1.5"><b>Người tạo</b>
            <NativeSelect value={createdBy} onChange={(e) => reset(setCreatedBy)(e.target.value)}>
              <option value="">Chọn người tạo</option>{users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
            </NativeSelect></div>
          <div className="space-y-1.5"><b>Loại khách hàng</b>
            <Pills value={type} onChange={reset(setType)} options={[["", "Tất cả"], ["PERSONAL", "Cá nhân"], ["COMPANY", "Công ty"]]} /></div>
          <div className="space-y-1.5"><b>Giới tính</b>
            <Pills value={gender} onChange={reset(setGender)} options={[["", "Tất cả"], ["MALE", "Nam"], ["FEMALE", "Nữ"]]} /></div>
        </aside>
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative w-full max-w-md">
            <Search className="absolute top-2 left-2.5 size-4 text-muted-foreground" />
            <Input className="bg-background pl-8" placeholder="Theo mã, tên, số điện thoại" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Button className="ml-auto" onClick={() => setCreating(true)}><Plus className="size-4" /> Khách hàng</Button>
        </div>
        <div className="overflow-x-auto rounded-lg bg-background">
          <Table>
            <TableHeader><TableRow className="bg-primary/10 hover:bg-primary/10">
              <TableHead>Mã khách hàng</TableHead><TableHead>Tên khách hàng</TableHead><TableHead>Điện thoại</TableHead>
              <TableHead className="text-right">Nợ hiện tại</TableHead><TableHead className="text-right">Tổng bán</TableHead>
              <TableHead className="text-right">Tổng bán trừ trả hàng</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              <TableRow className="font-semibold hover:bg-transparent">
                <TableCell colSpan={3} /><TableCell className="text-right">{formatMoney(data?.sumDebt ?? 0)}</TableCell>
                <TableCell className="text-right">{formatMoney(data?.sumSales ?? 0)}</TableCell>
                <TableCell className="text-right">{formatMoney(data?.sumNetSales ?? 0)}</TableCell>
              </TableRow>
              {data && !data.items.length && <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">Không tìm thấy khách hàng</TableCell></TableRow>}
              {data?.items.map((c) => (
                <Fragment key={c.id}>
                  <TableRow className={cn("cursor-pointer", expanded === c.id && "bg-primary/5")} onClick={() => setExpanded(expanded === c.id ? null : c.id)}>
                    <TableCell>{c.code}</TableCell><TableCell>{c.name}</TableCell><TableCell>{c.phone}</TableCell>
                    <TableCell className="text-right">{formatMoney(c.debt)}</TableCell>
                    <TableCell className="text-right">{formatMoney(c.totalSales)}</TableCell>
                    <TableCell className="text-right">{formatMoney(c.netSales)}</TableCell>
                  </TableRow>
                  {expanded === c.id && <TableRow className="hover:bg-transparent"><TableCell colSpan={6} className="p-0 whitespace-normal"><CustomerDetailPanel id={c.id} /></TableCell></TableRow>}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-end gap-2 text-sm">
          <span className="text-muted-foreground">{data?.total ?? 0} khách hàng — trang {page + 1}/{pages}</span>
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Trước</Button>
          <Button size="sm" variant="outline" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Sau</Button>
        </div>
      </div>
      {creating && <CustomerFormDialog branchId={me?.user.branches[0]?.id ?? ""} onClose={() => setCreating(false)} />}
    </div>
  );
}
