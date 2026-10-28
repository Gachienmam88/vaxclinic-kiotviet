"use client";

import { useEffect, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSuppliers } from "@/features/purchases/purchase-queries";
import type { Supplier } from "@/features/purchases/purchase-types";
import { SupplierFormDialog } from "@/features/purchases/supplier-form-dialog";
import { useCurrentUser } from "@/lib/use-current-user";

export default function SuppliersPage() {
  const { can } = useCurrentUser();
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [dialog, setDialog] = useState<{ key: number; supplier?: Supplier } | null>(null);
  useEffect(() => {
    const t = setTimeout(() => { setQ(search); setPage(0); }, 300);
    return () => clearTimeout(t);
  }, [search]);
  const { data, isLoading } = useSuppliers(q, page);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold">Nhà cung cấp</h1>
        <div className="relative ml-6 w-full max-w-md">
          <Search className="absolute top-2 left-2.5 size-4 text-muted-foreground" />
          <Input className="bg-background pl-8" placeholder="Theo mã, tên, điện thoại, mã số thuế"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {can("inventory.manage") && (
          <Button className="ml-auto" onClick={() => setDialog({ key: Date.now() })}><Plus className="size-4" /> Nhà cung cấp</Button>
        )}
      </div>
      <div className="rounded-lg bg-background">
        <Table>
          <TableHeader>
            <TableRow className="bg-primary/10 hover:bg-primary/10">
              <TableHead>Mã NCC</TableHead><TableHead>Tên nhà cung cấp</TableHead><TableHead>Điện thoại</TableHead>
              <TableHead>Email</TableHead><TableHead>Mã số thuế</TableHead><TableHead>Nhóm</TableHead><TableHead>Trạng thái</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Đang tải...</TableCell></TableRow>}
            {data && !data.items.length && <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Chưa có nhà cung cấp</TableCell></TableRow>}
            {data?.items.map((s) => (
              <TableRow key={s.id} className={can("inventory.manage") ? "cursor-pointer" : undefined}
                onClick={() => can("inventory.manage") && setDialog({ key: Date.now(), supplier: s })}>
                <TableCell className="font-medium">{s.code}</TableCell>
                <TableCell>{s.name}</TableCell><TableCell>{s.phone}</TableCell><TableCell>{s.email}</TableCell>
                <TableCell>{s.taxCode}</TableCell><TableCell>{s.groupName}</TableCell>
                <TableCell><Badge variant={s.active ? "default" : "secondary"}>{s.active ? "Đang hoạt động" : "Ngừng"}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end gap-2 text-sm">
        <span className="text-muted-foreground">{data?.total ?? 0} nhà cung cấp — trang {page + 1}/{pages}</span>
        <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Trước</Button>
        <Button size="sm" variant="outline" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Sau</Button>
      </div>
      {dialog && <SupplierFormDialog key={dialog.key} supplier={dialog.supplier} onClose={() => setDialog(null)} />}
    </div>
  );
}
