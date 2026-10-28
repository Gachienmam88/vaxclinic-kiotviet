"use client";

import { useEffect, useState } from "react";
import { useDeepLinkExpanded, type DeepLink } from "@/components/ui/deep-link-route";
import type { PurchaseFilters } from "@/features/purchases/purchase-queries";
import { useBranches } from "@/features/settings/settings-queries";

/**
 * Trạng thái dùng chung của trang danh sách phiếu kho: bộ lọc, ô tìm (debounce 300ms), trang.
 * Link sâu ?code=: lọc theo mã, mọi trạng thái (allStatuses), toàn thời gian. Dòng mở: xem useInventoryExpanded.
 */
export function useInventoryListState(initial: PurchaseFilters, link: DeepLink, allStatuses: string[]) {
  const [filters, setFilters] = useState(link.code ? { ...initial, q: link.code, statuses: allStatuses, period: "custom" as const } : initial);
  const [search, setSearch] = useState(link.code ?? "");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(15);
  const { data: branches = [] } = useBranches();
  useEffect(() => {
    const t = setTimeout(() => { setFilters((f) => ({ ...f, q: search })); setPage(0); }, 300);
    return () => clearTimeout(t);
  }, [search]);
  return {
    filters, search, setSearch, page, setPage, size,
    setSize: (n: number) => { setSize(n); setPage(0); },
    applyFilters: (f: PurchaseFilters) => { setFilters(f); setPage(0); },
    branchName: (id: string) => branches.find((b) => b.id === id)?.name ?? "",
  };
}

/** Dòng đang mở chi tiết: bấm dòng mở / bấm lại đóng; link sâu → mở sẵn phiếu có mã trùng ?code=. */
export function useInventoryExpanded<T extends { id: string; code: string }>(items: T[] | undefined, link: DeepLink) {
  const { open, toggle } = useDeepLinkExpanded(items, link, (d) => [d.code]);
  return { expanded: open, toggle };
}
