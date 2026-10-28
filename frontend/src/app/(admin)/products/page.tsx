"use client";

import { Fragment, useEffect, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProductDetailPanel } from "@/features/products/product-detail-panel";
import { ProductFilterSidebar } from "@/features/products/product-filter-sidebar";
import { ProductFormDialog } from "@/features/products/product-form-dialog";
import { EMPTY_FILTERS, useProducts } from "@/features/products/product-queries";
import type { ProductDetail } from "@/features/products/product-types";
import { formatMoney, formatNumber } from "@/lib/format";
import { useCurrentUser } from "@/lib/use-current-user";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 15;
const COLS = 8;

export default function ProductsPage() {
  const { can } = useCurrentUser();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ key: number; product?: ProductDetail } | null>(null);

  // Gõ tìm kiếm: đợi 300ms rồi mới gọi API.
  useEffect(() => {
    const t = setTimeout(() => { setFilters((f) => ({ ...f, q: search })); setPage(0); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading } = useProducts(filters, page, PAGE_SIZE);
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="flex gap-4">
      <div className="space-y-4">
        <h1 className="text-xl font-bold">Hàng hóa</h1>
        <ProductFilterSidebar filters={filters} onChange={(f) => { setFilters(f); setPage(0); }} />
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative w-full max-w-md">
            <Search className="absolute top-2 left-2.5 size-4 text-muted-foreground" />
            <Input className="bg-background pl-8" placeholder="Theo mã, tên hàng, mã vạch"
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {can("catalog.manage") && (
            <Button className="ml-auto" onClick={() => setDialog({ key: Date.now() })}>
              <Plus className="size-4" /> Tạo mới
            </Button>
          )}
        </div>
        <div className="overflow-x-auto rounded-lg bg-background">
          <Table>
            <TableHeader>
              <TableRow className="bg-primary/10 hover:bg-primary/10">
                <TableHead>Mã hàng</TableHead><TableHead>Tên hàng</TableHead><TableHead>Tên viết tắt</TableHead>
                <TableHead className="text-right">Giá bán</TableHead><TableHead>VAT hàng bán</TableHead>
                <TableHead>Áp dụng giảm thuế</TableHead><TableHead className="text-right">Giá vốn</TableHead>
                <TableHead className="text-right">Tồn kho</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="font-semibold hover:bg-transparent">
                <TableCell colSpan={COLS - 1} />
                <TableCell className="text-right">{formatNumber(data?.totalStock ?? 0)}</TableCell>
              </TableRow>
              {isLoading && (
                <TableRow><TableCell colSpan={COLS} className="py-8 text-center text-muted-foreground">Đang tải...</TableCell></TableRow>
              )}
              {data && !data.items.length && (
                <TableRow><TableCell colSpan={COLS} className="py-8 text-center text-muted-foreground">Không tìm thấy hàng hóa nào</TableCell></TableRow>
              )}
              {data?.items.map((p) => (
                <Fragment key={p.id}>
                  <TableRow onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                    className={cn("cursor-pointer align-top", expanded === p.id && "bg-primary/5", !p.active && "text-muted-foreground")}>
                    <TableCell className="font-medium">{p.code}</TableCell>
                    <TableCell className="max-w-72 whitespace-normal">
                      {p.name} <span className="text-muted-foreground">({p.unitName})</span>
                      {p.otherUnits.length > 0 && <span className="text-primary"> · {p.otherUnits.join(", ")}</span>}
                      {p.lotManaged && <Badge variant="outline" className="ml-1">Lô</Badge>}
                    </TableCell>
                    <TableCell>{p.shortName}</TableCell>
                    <TableCell className="text-right">{formatMoney(p.price)}</TableCell>
                    <TableCell className="max-w-40 truncate" title={p.taxRateName ?? ""}>{p.taxRateName?.split(" ")[0]}</TableCell>
                    <TableCell>{p.taxReduction ? "Có áp dụng" : "Không áp dụng"}</TableCell>
                    <TableCell className="text-right">{formatNumber(p.cost)}</TableCell>
                    <TableCell className="text-right">{formatNumber(p.stock)}</TableCell>
                  </TableRow>
                  {expanded === p.id && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={COLS} className="p-0 whitespace-normal">
                        <ProductDetailPanel productId={p.id} onEdit={(product) => setDialog({ key: Date.now(), product })} />
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-end gap-2 text-sm">
          <span className="text-muted-foreground">{data?.total ?? 0} hàng hóa — trang {page + 1}/{pages}</span>
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Trước</Button>
          <Button size="sm" variant="outline" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Sau</Button>
        </div>
      </div>
      {dialog && <ProductFormDialog key={dialog.key} product={dialog.product} onClose={() => setDialog(null)} />}
    </div>
  );
}
