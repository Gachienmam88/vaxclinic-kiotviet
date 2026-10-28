"use client";

import { useEffect, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { exportSuppliersCsv } from "@/features/purchases/purchase-csv-export";
import {
  LIST_HEADER_ROW, PurchaseListLayout, PurchaseListPager, PurchaseListToolbar,
} from "@/features/purchases/purchase-list-chrome";
import { useSuppliers } from "@/features/purchases/purchase-queries";
import type { Supplier } from "@/features/purchases/purchase-types";
import { SupplierFormDialog } from "@/features/purchases/supplier-form-dialog";
import { useCurrentUser } from "@/lib/use-current-user";
import { cn } from "@/lib/utils";

const COLS = 7;

export default function SuppliersPage() {
  const { can } = useCurrentUser();
  const manage = can("inventory.manage");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(15);
  const [dialog, setDialog] = useState<{ key: number; supplier?: Supplier } | null>(null);
  useEffect(() => {
    const t = setTimeout(() => { setQ(search); setPage(0); }, 300);
    return () => clearTimeout(t);
  }, [search]);
  const { data, isLoading } = useSuppliers(q, page, size);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;
  const open = (supplier?: Supplier) => setDialog({ key: Date.now(), supplier });

  return (
    <PurchaseListLayout title="Nhà cung cấp"
      toolbar={<PurchaseListToolbar search={search} onSearch={setSearch} placeholder="Theo mã, tên, điện thoại, mã số thuế"
        createLabel={manage ? "Nhà cung cấp" : undefined} onCreate={() => open()}
        onExport={data?.items.length ? () => exportSuppliersCsv(data.items) : undefined} />}>
      <div className="min-h-[calc(100vh-190px)] overflow-hidden rounded-lg bg-background">
        <Table>
          <TableHeader>
            <TableRow className={LIST_HEADER_ROW}>
              <TableHead className="pl-4">Mã nhà cung cấp</TableHead><TableHead>Tên nhà cung cấp</TableHead><TableHead>Điện thoại</TableHead>
              <TableHead>Email</TableHead><TableHead>Mã số thuế</TableHead><TableHead>Nhóm nhà cung cấp</TableHead>
              <TableHead className="pr-4">Trạng thái</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={COLS} className="py-8 text-center text-muted-foreground">Đang tải...</TableCell></TableRow>}
            {data && !data.items.length && (
              <TableRow className="hover:bg-transparent"><TableCell colSpan={COLS} className="py-16 text-center text-muted-foreground">Chưa có nhà cung cấp</TableCell></TableRow>
            )}
            {data?.items.map((s) => (
              <TableRow key={s.id} className={cn("[&>td]:py-2.5", manage && "cursor-pointer")} tabIndex={manage ? 0 : undefined}
                onClick={() => manage && open(s)} onKeyDown={(e) => manage && e.key === "Enter" && open(s)}>
                <TableCell className="pl-4">{s.code}</TableCell>
                <TableCell className="max-w-72 whitespace-normal">{s.name}</TableCell><TableCell>{s.phone}</TableCell><TableCell>{s.email}</TableCell>
                <TableCell>{s.taxCode}</TableCell><TableCell>{s.groupName}</TableCell>
                <TableCell className="pr-4">
                  <span className={cn("inline-flex h-5 items-center rounded px-1.5 text-xs font-medium",
                    s.active ? "bg-[#e6f6ec] text-[#0d9f4f]" : "bg-[#eff0f3] text-muted-foreground")}>
                    {s.active ? "Đang hoạt động" : "Ngừng hoạt động"}</span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <PurchaseListPager size={size} onSize={(n) => { setSize(n); setPage(0); }} page={page} pages={pages}
        total={data?.total ?? 0} unit="nhà cung cấp" onPage={setPage} />
      {dialog && <SupplierFormDialog key={dialog.key} supplier={dialog.supplier} onClose={() => setDialog(null)} />}
    </PurchaseListLayout>
  );
}
