"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, FileUp, Info, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NativeSelect } from "@/features/products/product-form-sections";
import {
  NATURE_LABEL, useBuyerTaxCodes, useInputInvoices, useTaxConnections, type TaxConnection,
} from "@/features/integrations/integration-queries";
import { SyncDialog, TaxConnectionDialog } from "@/features/integrations/tax-connection-dialogs";
import { api, errorMessage } from "@/lib/api-client";
import { formatDate, formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

function Connections({ onEdit }: { onEdit: (c?: TaxConnection) => void }) {
  const qc = useQueryClient();
  const { data = [] } = useTaxConnections();
  const remove = useMutation({
    mutationFn: (id: string) => api(`/tax-connections/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tax-connections"] }),
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div className="space-y-3">
      <p className="flex items-center justify-center gap-2 rounded-md bg-primary/10 p-2 text-sm text-primary">
        <Info className="size-4" /> Lưu ý: có thể kết nối nhiều tài khoản để quản lý hóa đơn của nhiều doanh nghiệp cùng lúc.</p>
      {!data.length && <p className="py-8 text-center text-sm text-muted-foreground">Chưa có kết nối nào — bấm "Thêm kết nối"</p>}
      {data.map((c) => (
        <div key={c.id} className="space-y-3 rounded-lg border bg-background p-4 text-sm">
          <div className="flex items-center gap-2 font-semibold">Kết nối Cơ quan Thuế
            <Badge variant={c.lastError ? "destructive" : "default"}>{c.lastError ? "Lỗi đồng bộ" : "Đang hoạt động"}</Badge></div>
          <div className="grid grid-cols-4 gap-4">
            {[["Website", "https://hoadondientu.gdt.gov.vn/"], ["Mã số thuế", c.taxCode], ["Tên đăng nhập", c.username], ["Mật khẩu", "******"]]
              .map(([k, v]) => <div key={k} className="border-b pb-1"><div className="text-xs text-muted-foreground">{k}</div>{v}</div>)}
          </div>
          {c.lastError && <p className="text-xs text-destructive">{c.lastError}</p>}
          <div className="flex items-center gap-2 border-t pt-2">
            <span className="text-muted-foreground">Đồng bộ lần cuối: {c.lastSyncedAt ? formatDateTime(c.lastSyncedAt) : "chưa đồng bộ"}</span>
            <Button size="sm" variant="outline" className="ml-auto" onClick={() => onEdit(c)}><Pencil className="size-3.5" /> Sửa thiết lập</Button>
            <Button size="sm" variant="outline" onClick={() => confirm(`Xóa kết nối MST ${c.taxCode}?`) && remove.mutate(c.id)}><Trash2 className="size-3.5" /> Xóa</Button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function InputInvoicesPage() {
  const qc = useQueryClient();
  const { data: connections = [] } = useTaxConnections();
  const { data: buyers = [] } = useBuyerTaxCodes();
  const [tab, setTab] = useState("invoices");
  const [dialog, setDialog] = useState<{ edit?: TaxConnection } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [f, setF] = useState({ q: "", from: "", to: "", buyer: "", seller: "", status: "" });
  const [expanded, setExpanded] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const params = useMemo(() => {
    const p = new URLSearchParams({ size: "50" });
    if (f.q) p.set("q", f.q);
    if (f.from) p.set("from", f.from);
    if (f.to) p.set("to", f.to);
    if (f.buyer) p.set("buyerTaxCode", f.buyer);
    if (f.seller) p.set("seller", f.seller);
    if (f.status) p.set("receiptStatus", f.status);
    return p;
  }, [f]);
  const { data } = useInputInvoices(params);

  async function importXml(files: FileList | null) {
    if (!files?.length) return;
    const form = new FormData();
    Array.from(files).forEach((file) => form.append("files", file));
    const res = await fetch("/api/backend/input-invoices/import", { method: "POST", body: form });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return toast.error(body.message ?? "Nhập file thất bại");
    toast.success(`Đã đọc ${body.files} file, thêm ${body.added} hóa đơn mới`);
    body.errors?.forEach((e: string) => toast.error(e));
    qc.invalidateQueries({ queryKey: ["input-invoices"] });
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <div><h1 className="text-xl font-bold">Hóa đơn đầu vào</h1>
          <p className="text-sm text-muted-foreground">Quản lý hóa đơn đầu vào, tối ưu việc nhập liệu khi tạo phiếu nhập.</p></div>
        <div className="ml-auto flex gap-2">
          {tab === "connections"
            ? <Button variant="outline" className="border-primary text-primary" onClick={() => setDialog({})}><Plus className="size-4" /> Thêm kết nối</Button>
            : <>
              <Button variant="outline" className="border-primary text-primary" disabled={!connections.length} onClick={() => setSyncing(true)}>
                <RefreshCw className="size-4" /> Đồng bộ hóa đơn</Button>
              <Button variant="outline" onClick={() => fileRef.current?.click()}><FileUp className="size-4" /> Nhập file XML</Button>
              <input ref={fileRef} type="file" accept=".xml" multiple hidden onChange={(e) => importXml(e.target.files)} />
            </>}
        </div>
      </div>
      <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
        <TabsList variant="line">
          <TabsTrigger value="connections">Danh sách kết nối ({connections.length})</TabsTrigger>
          <TabsTrigger value="invoices">Danh sách hóa đơn ({data?.total ?? 0})</TabsTrigger>
        </TabsList>
        <TabsContent value="connections" className="pt-3"><Connections onEdit={(c) => setDialog({ edit: c })} /></TabsContent>
        <TabsContent value="invoices" className="flex gap-4 pt-3">
          <aside className="w-60 shrink-0 space-y-4 rounded-lg bg-background p-4 text-sm">
            <div className="space-y-1.5"><b>Thời gian (ngày hóa đơn)</b>
              <Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />
              <Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></div>
            <div className="space-y-1.5"><b>Mã số thuế</b>
              <NativeSelect value={f.buyer} onChange={(e) => setF({ ...f, buyer: e.target.value })}>
                <option value="">Tất cả</option>{buyers.filter(Boolean).map((b) => <option key={b}>{b}</option>)}</NativeSelect></div>
            <div className="space-y-1.5"><b>Nhà cung cấp</b>
              <Input placeholder="Tên hoặc MST người bán" value={f.seller} onChange={(e) => setF({ ...f, seller: e.target.value })} /></div>
            <div className="space-y-1.5"><b>Trạng thái lập phiếu</b>
              <NativeSelect value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
                <option value="">Tất cả</option><option value="NOT_CREATED">Chưa lập phiếu</option><option value="CREATED">Đã lập phiếu</option></NativeSelect></div>
          </aside>
          <div className="min-w-0 flex-1 space-y-3">
            <Input className="max-w-md bg-background" placeholder="Tìm theo số hóa đơn..." value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
            <div className="overflow-x-auto rounded-lg bg-background">
              <Table>
                <TableHeader><TableRow className="bg-primary/10 hover:bg-primary/10">
                  <TableHead>Số hóa đơn</TableHead><TableHead>Ngày hóa đơn</TableHead><TableHead>Nhà cung cấp</TableHead>
                  <TableHead>Mã số thuế</TableHead><TableHead className="text-right">Tổng tiền</TableHead>
                  <TableHead>Trạng thái lập phiếu</TableHead><TableHead>Tính chất</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  <TableRow className="font-semibold hover:bg-transparent"><TableCell colSpan={4} />
                    <TableCell className="text-right">{formatMoney(data?.sumTotal ?? 0)}</TableCell><TableCell colSpan={3} /></TableRow>
                  {data && !data.items.length && <TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground">Chưa có hóa đơn — đồng bộ từ cổng thuế hoặc nhập file XML</TableCell></TableRow>}
                  {data?.items.map((i) => (
                    <Fragment key={i.id}>
                      <TableRow className={cn("cursor-pointer", expanded === i.id && "bg-primary/5")} onClick={() => setExpanded(expanded === i.id ? null : i.id)}>
                        <TableCell className="font-medium">{i.number}</TableCell><TableCell>{formatDate(i.issuedAt)}</TableCell>
                        <TableCell className="max-w-72 whitespace-normal">{i.sellerName} - {i.sellerTaxCode}</TableCell>
                        <TableCell>{i.buyerTaxCode}</TableCell><TableCell className="text-right">{formatMoney(i.total)}</TableCell>
                        <TableCell>{i.receiptId
                          ? <Badge className="bg-green-100 text-green-700">Đã lập phiếu {i.receiptCode}</Badge>
                          : <Badge variant="secondary">Chưa lập phiếu</Badge>}</TableCell>
                        <TableCell><Badge variant="outline">{NATURE_LABEL[i.nature]}</Badge></TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {!i.receiptId && <Button size="sm" render={<Link href={`/purchases/receipts/new?fromInputInvoice=${i.id}`} />}>
                            <ExternalLink className="size-3.5" /> Lập phiếu nhập</Button>}
                        </TableCell>
                      </TableRow>
                      {expanded === i.id && (
                        <TableRow className="hover:bg-transparent"><TableCell colSpan={8} className="bg-background p-4 whitespace-normal">
                          <p className="mb-2 text-sm">Ký hiệu <b>{i.templateNo}{i.series}</b> · số <b>{i.number}</b> · trước thuế {formatMoney(i.totalBeforeTax ?? 0)} · thuế {formatMoney(i.vatAmount ?? 0)} · nguồn {i.source === "XML" ? "file XML" : "cổng thuế"}</p>
                          <table className="w-full text-sm"><thead className="bg-muted/60 text-left"><tr><th className="px-2 py-1.5">Tên hàng</th><th className="px-2">ĐVT</th>
                            <th className="px-2 text-right">SL</th><th className="px-2 text-right">Đơn giá</th><th className="px-2">Thuế suất</th><th className="px-2 text-right">Thành tiền</th></tr></thead>
                            <tbody>{i.lines.map((l, n) => (
                              <tr key={n} className="border-b"><td className="px-2 py-1.5">{l.name}</td><td className="px-2">{l.unit}</td>
                                <td className="px-2 text-right">{formatNumber(l.quantity)}</td><td className="px-2 text-right">{formatNumber(l.unitPrice)}</td>
                                <td className="px-2">{l.vatRate}</td><td className="px-2 text-right">{formatMoney(l.amount)}</td></tr>))}</tbody></table>
                        </TableCell></TableRow>)}
                    </Fragment>))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
      {dialog && <TaxConnectionDialog connection={dialog.edit} onClose={() => setDialog(null)} />}
      {syncing && <SyncDialog connections={connections} onClose={() => setSyncing(false)} />}
    </div>
  );
}
