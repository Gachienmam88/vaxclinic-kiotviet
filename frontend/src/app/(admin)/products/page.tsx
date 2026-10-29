"use client";

import { useEffect, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DeepLinkRoute, useDeepLinkExpanded, type DeepLink } from "@/components/ui/deep-link-route";
import { ProductFilterSidebar } from "@/features/products/product-filter-sidebar";
import { ProductFormDialog } from "@/features/products/product-form-dialog";
import { ProductListTable } from "@/features/products/product-list-table";
import { EMPTY_FILTERS, useProducts } from "@/features/products/product-queries";
import type { ProductDetail } from "@/features/products/product-types";
import { useCurrentUser } from "@/lib/use-current-user";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { productsNs } from "@/messages/products";

const PAGE_SIZE = 15;

/** Hàng hóa. Link sâu ?code=SP000123 (mã hàng hoặc mã đơn vị tính) → tìm theo mã, mọi trạng thái + mở sẵn chi tiết. */
function ProductsPage({ link }: { link: DeepLink }) {
  const { can } = useCurrentUser();
  const t = useT(productsNs);
  const tc = useT(commonNs);
  const [filters, setFilters] = useState<typeof EMPTY_FILTERS>(link.code ? { ...EMPTY_FILTERS, q: link.code, active: "all" } : EMPTY_FILTERS);
  const [search, setSearch] = useState(link.code ?? "");
  const [page, setPage] = useState(0);
  /** product = sửa; copyFrom = Sao chép (form tạo mới điền sẵn từ hàng đó). */
  const [dialog, setDialog] = useState<{ key: number; product?: ProductDetail; copyFrom?: ProductDetail } | null>(null);

  // Gõ tìm kiếm: đợi 300ms rồi mới gọi API.
  useEffect(() => {
    const timer = setTimeout(() => { setFilters((f) => ({ ...f, q: search })); setPage(0); }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useProducts(filters, page, PAGE_SIZE);
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  // Mã đơn vị tính khác mã hàng: server tìm cả mã ĐVT → kết quả duy nhất là hàng cần mở
  const { open: expanded, toggle } = useDeepLinkExpanded(data?.items, link, (p) => [p.code, data?.items.length === 1 ? link.code : null]);

  return (
    <div className="space-y-2.5">
      {/* Hàng tiêu đề: tiêu đề nằm trên cột sidebar (200px), ô tìm kiếm + nút thao tác nằm trên bảng */}
      <div className="flex items-center gap-2.5">
        <h1 className="w-[200px] shrink-0 text-lg font-bold">{t("list.title")}</h1>
        <div className="relative w-full max-w-[400px]">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label={t("list.searchAria")} placeholder={t("list.searchPlaceholder")} className="rounded-md bg-background pl-8"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {can("catalog.manage") && (
          <Button variant="outline" className="ml-auto h-[30px] rounded-md border-primary px-2.5 text-primary hover:bg-primary/5 hover:text-primary"
            onClick={() => setDialog({ key: Date.now() })}>
            <Plus className="size-4" /> {t("form.createNew")}
          </Button>
        )}
      </div>
      <div className="flex items-start gap-2.5">
        <ProductFilterSidebar filters={filters} onChange={(f) => { setFilters(f); setPage(0); }} />
        <div className="min-w-0 flex-1 space-y-2.5">
          <ProductListTable data={data} isLoading={isLoading} expanded={expanded}
            onToggle={toggle}
            onEdit={(product) => setDialog({ key: Date.now(), product })}
            onCopy={(copyFrom) => setDialog({ key: Date.now(), copyFrom })} />
          <div className="flex items-center justify-end gap-2 text-[13px]">
            <span className="text-muted-foreground">{t("list.pageInfo", { total: data?.total ?? 0, page: page + 1, pages })}</span>
            <Button size="sm" variant="outline" className="rounded-md" disabled={page === 0} onClick={() => setPage(page - 1)}>{tc("pager.prev")}</Button>
            <Button size="sm" variant="outline" className="rounded-md" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>{tc("pager.next")}</Button>
          </div>
        </div>
      </div>
      {dialog && <ProductFormDialog key={dialog.key} product={dialog.product} copyFrom={dialog.copyFrom} onClose={() => setDialog(null)} />}
    </div>
  );
}

export default function Page() {
  return <DeepLinkRoute>{(link) => <ProductsPage link={link} />}</DeepLinkRoute>;
}
