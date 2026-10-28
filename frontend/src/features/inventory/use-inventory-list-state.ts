"use client";

import { useEffect, useState } from "react";
import type { PurchaseFilters } from "@/features/purchases/purchase-queries";
import { useBranches } from "@/features/settings/settings-queries";

/** Trạng thái dùng chung của trang danh sách phiếu kho: bộ lọc, ô tìm (debounce 300ms), trang, dòng đang mở. */
export function useInventoryListState(initial: PurchaseFilters) {
  const [filters, setFilters] = useState(initial);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(15);
  const [expanded, setExpanded] = useState<string | null>(null);
  const { data: branches = [] } = useBranches();
  useEffect(() => {
    const t = setTimeout(() => { setFilters((f) => ({ ...f, q: search })); setPage(0); }, 300);
    return () => clearTimeout(t);
  }, [search]);
  return {
    filters, search, setSearch, page, setPage, size, expanded,
    setSize: (n: number) => { setSize(n); setPage(0); },
    applyFilters: (f: PurchaseFilters) => { setFilters(f); setPage(0); },
    toggle: (id: string) => setExpanded((cur) => (cur === id ? null : id)),
    branchName: (id: string) => branches.find((b) => b.id === id)?.name ?? "",
  };
}
