"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PurchaseListLayout, PurchaseListPager } from "@/features/purchases/purchase-list-chrome";
import { SupplierFilterSidebar } from "@/features/purchases/supplier-filter-sidebar";
import { SupplierFormDialog } from "@/features/purchases/supplier-form-dialog";
import { SupplierImportDialog } from "@/features/purchases/supplier-import-dialog";
import { SUPPLIER_COLUMNS, SUPPLIER_CSV_HEADER, supplierCsvRow } from "@/features/purchases/supplier-list-columns";
import { SupplierListTable } from "@/features/purchases/supplier-list-table";
import { SupplierListToolbar } from "@/features/purchases/supplier-list-toolbar";
import { supplierParams, useSupplierList } from "@/features/purchases/supplier-queries";
import { DEFAULT_SUPPLIER_FILTERS, type SupplierFilters, type SupplierPage, type SupplierRow } from "@/features/purchases/supplier-types";
import { downloadCsv } from "@/features/sales/customer-csv-export";
import { api } from "@/lib/api-client";
import { useCurrentUser } from "@/lib/use-current-user";

const COLUMNS_KEY = "supplier-list-columns";
const defaultColumns = () => SUPPLIER_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key);

/** Mua hàng → Nhà cung cấp (KiotViet): bộ lọc trái, bảng NCC có nợ/tổng mua, chi tiết mở dưới dòng. */
export default function SuppliersPage() {
  const { can } = useCurrentUser();
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<SupplierFilters>(DEFAULT_SUPPLIER_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(15);
  const [columns, setColumns] = useState<string[]>(defaultColumns);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [dialog, setDialog] = useState<"create" | "import" | null>(null);
  const [exporting, setExporting] = useState(false);
  useEffect(() => { const t = setTimeout(() => { setQ(search); setPage(0); }, 300); return () => clearTimeout(t); }, [search]);
  useEffect(() => {
    try { const saved = JSON.parse(localStorage.getItem(COLUMNS_KEY) ?? "null"); if (Array.isArray(saved)) setColumns(saved); } catch { /* bỏ qua */ }
  }, []);
  const { data, isLoading } = useSupplierList(supplierParams(q, filters, page, size));
  const pages = data ? Math.max(1, Math.ceil(data.total / size)) : 1;

  const changeColumns = (keys: string[]) => {
    setColumns(keys);
    try { localStorage.setItem(COLUMNS_KEY, JSON.stringify(keys)); } catch { /* bỏ qua */ }
  };
  // Xuất file: NCC đã chọn, hoặc toàn bộ kết quả lọc (lấy lần lượt từng trang 100 dòng)
  async function exportCsv() {
    setExporting(true);
    try {
      const rows: SupplierRow[] = [];
      for (let p = 0; ; p++) {
        const res = await api<SupplierPage>(`/suppliers?${supplierParams(q, filters, p, 100)}`);
        rows.push(...res.items);
        if ((p + 1) * 100 >= res.total) break;
      }
      const out = selected.length ? rows.filter((s) => selected.includes(s.id)) : rows;
      downloadCsv("danh-sach-nha-cung-cap.csv", SUPPLIER_CSV_HEADER, out.map(supplierCsvRow));
    } catch {
      toast.error("Không xuất được file");
    } finally {
      setExporting(false);
    }
  }

  return (
    <PurchaseListLayout title="Nhà cung cấp"
      toolbar={<SupplierListToolbar search={search} onSearch={setSearch} filtersOpen={filtersOpen} onToggleFilters={() => setFiltersOpen(!filtersOpen)}
        canManage={can("inventory.manage")} onCreate={() => setDialog("create")} onImport={() => setDialog("import")}
        onExport={exportCsv} exporting={exporting} columns={columns} onColumns={changeColumns} size={size}
        onSize={(n) => { setSize(n); setPage(0); }} />}
      sidebar={filtersOpen ? <SupplierFilterSidebar value={filters} onChange={(v) => { setFilters(v); setPage(0); setExpanded(null); }} /> : undefined}>
      <SupplierListTable data={data} loading={isLoading} columns={columns} expanded={expanded} onExpand={setExpanded}
        selected={selected} onSelect={setSelected} />
      <PurchaseListPager size={size} onSize={(n) => { setSize(n); setPage(0); }} page={page} pages={pages} total={data?.total ?? 0}
        unit="nhà cung cấp" onPage={(p) => { setPage(p); setExpanded(null); }} />
      {dialog === "create" && <SupplierFormDialog onClose={() => setDialog(null)} />}
      {dialog === "import" && <SupplierImportDialog onClose={() => setDialog(null)} />}
    </PurchaseListLayout>
  );
}
