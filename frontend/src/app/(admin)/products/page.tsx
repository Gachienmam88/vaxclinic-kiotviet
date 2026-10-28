"use client";

import { useEffect, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductFilterSidebar } from "@/features/products/product-filter-sidebar";
import { ProductFormDialog } from "@/features/products/product-form-dialog";
import { ProductListTable } from "@/features/products/product-list-table";
import { EMPTY_FILTERS, useProducts } from "@/features/products/product-queries";
import type { ProductDetail } from "@/features/products/product-types";
import { useCurrentUser } from "@/lib/use-current-user";

const PAGE_SIZE = 15;

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
    <div className="space-y-2.5">
      {/* Hàng tiêu đề: tiêu đề nằm trên cột sidebar (200px), ô tìm kiếm + nút thao tác nằm trên bảng */}
      <div className="flex items-center gap-2.5">
        <h1 className="w-[200px] shrink-0 text-lg font-bold">Hàng hóa</h1>
        <div className="relative w-full max-w-[400px]">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <input aria-label="Tìm hàng hóa" placeholder="Theo mã, tên hàng, mã vạch"
            className="h-8 w-full rounded-md border border-input bg-background pr-2.5 pl-8 text-[13px] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {can("catalog.manage") && (
          <Button variant="outline" className="ml-auto h-[30px] rounded-md border-primary px-2.5 text-primary hover:bg-primary/5 hover:text-primary"
            onClick={() => setDialog({ key: Date.now() })}>
            <Plus className="size-4" /> Tạo mới
          </Button>
        )}
      </div>
      <div className="flex items-start gap-2.5">
        <ProductFilterSidebar filters={filters} onChange={(f) => { setFilters(f); setPage(0); }} />
        <div className="min-w-0 flex-1 space-y-2.5">
          <ProductListTable data={data} isLoading={isLoading} expanded={expanded}
            onToggle={(id) => setExpanded(expanded === id ? null : id)}
            onEdit={(product) => setDialog({ key: Date.now(), product })} />
          <div className="flex items-center justify-end gap-2 text-[13px]">
            <span className="text-muted-foreground">{data?.total ?? 0} hàng hóa — trang {page + 1}/{pages}</span>
            <Button size="sm" variant="outline" className="rounded-md" disabled={page === 0} onClick={() => setPage(page - 1)}>Trước</Button>
            <Button size="sm" variant="outline" className="rounded-md" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Sau</Button>
          </div>
        </div>
      </div>
      {dialog && <ProductFormDialog key={dialog.key} product={dialog.product} onClose={() => setDialog(null)} />}
    </div>
  );
}
