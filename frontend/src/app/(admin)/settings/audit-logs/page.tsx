"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { NativeSelect } from "@/features/products/product-form-sections";
import { useUserLookup } from "@/features/purchases/purchase-queries";
import { api, type PageResponse } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";

type AuditLog = { id: number; occurredAt: string; userName: string | null; feature: string; action: string; docCode: string | null; detail: string | null };

const PAGE = 20;

/** Thiết lập → Lịch sử thao tác: ai làm gì, lúc nào (hóa đơn, phiếu thu chi, nhập hàng, thiết lập...). */
export default function AuditLogsPage() {
  const { data: users = [] } = useUserLookup();
  const { data: features = [] } = useQuery({ queryKey: ["audit-features"], queryFn: () => api<string[]>("/audit-logs/features") });
  const [f, setF] = useState({ userId: "", feature: "", from: "", to: "", q: "" });
  const [page, setPage] = useState(0);
  const params = useMemo(() => {
    const p = new URLSearchParams();
    Object.entries(f).forEach(([k, v]) => v && p.set(k, v));
    return p;
  }, [f]);
  const { data } = useQuery({
    queryKey: ["audit-logs", params.toString(), page],
    queryFn: () => api<PageResponse<AuditLog>>(`/audit-logs?${params}&page=${page}&size=${PAGE}`),
  });
  const set = (k: keyof typeof f, v: string) => { setF({ ...f, [k]: v }); setPage(0); };
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE)) : 1;

  async function exportFile() {
    const res = await fetch(`/api/backend/audit-logs/export?${params}`, { headers: { Accept: "text/csv" } });
    if (!res.ok) { toast.error("Không xuất được file"); return; }
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url; a.download = "lich-su-thao-tac.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="rounded-lg bg-background">
      <div className="flex items-start gap-3 border-b px-5 py-4">
        <div className="flex-1">
          <h2 className="font-semibold">Lịch sử thao tác</h2>
          <p className="text-sm text-muted-foreground">Theo dõi tất cả thao tác của nhân viên trên hệ thống.</p>
        </div>
        <Button variant="outline" onClick={exportFile}><Download className="size-4" /> Xuất file</Button>
      </div>
      <div className="flex flex-wrap items-end gap-2 px-5 pt-3 text-sm">
        <div className="w-44"><NativeSelect value={f.userId} onChange={(e) => set("userId", e.target.value)}>
          <option value="">Tất cả nhân viên</option>{users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}</NativeSelect></div>
        <div className="w-44"><NativeSelect value={f.feature} onChange={(e) => set("feature", e.target.value)}>
          <option value="">Tất cả tính năng</option>{features.map((x) => <option key={x}>{x}</option>)}</NativeSelect></div>
        <Input type="date" className="h-8 w-36" value={f.from} onChange={(e) => set("from", e.target.value)} title="Từ ngày" />
        <Input type="date" className="h-8 w-36" value={f.to} onChange={(e) => set("to", e.target.value)} title="Đến ngày" />
        <Input className="h-8 w-60" placeholder="Mã chứng từ, nội dung" value={f.q} onChange={(e) => set("q", e.target.value)} />
      </div>
      <div className="p-4">
        <Table>
          <TableHeader><TableRow>
            <TableHead className="w-40">Nhân viên</TableHead><TableHead className="w-36">Tính năng</TableHead>
            <TableHead className="w-40">Thời gian</TableHead><TableHead>Chi tiết</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {data && !data.items.length && <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">Chưa có dữ liệu</TableCell></TableRow>}
            {data?.items.map((l) => (
              <TableRow key={l.id}>
                <TableCell>{l.userName}</TableCell>
                <TableCell>{l.feature}<span className="block text-xs text-muted-foreground">{l.action}</span></TableCell>
                <TableCell>{formatDateTime(l.occurredAt)}</TableCell>
                <TableCell className="whitespace-normal">{l.detail}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="mt-2 flex items-center justify-end gap-2 text-sm">
          <span className="text-muted-foreground">Tổng {data?.total ?? 0} thao tác — trang {page + 1}/{pages}</span>
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Trước</Button>
          <Button size="sm" variant="outline" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Sau</Button>
        </div>
      </div>
    </div>
  );
}
