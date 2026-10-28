"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DeepLinkRoute, useDeepLinkExpanded, type DeepLink } from "@/components/ui/deep-link-route";
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
import { useT } from "@/lib/i18n";
import { purchasesNs } from "@/messages/purchases";

const COLUMNS_KEY = "supplier-list-columns";
const defaultColumns = () => SUPPLIER_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key);

/**
 * Mua hàng → Nhà cung cấp (KiotViet): bộ lọc trái, bảng NCC có nợ/tổng mua, chi tiết mở dưới dòng.
 * Link sâu: ?code=NCC000001 → tìm theo mã NCC; ?code=PCN…/CKN…/DCN… (mã khác NCC) → NCC có phiếu công nợ đó,
 * mở sẵn tab "Nợ cần trả nhà cung cấp" + phiếu. Cả hai bỏ lọc "Đang hoạt động".
 */
function SuppliersPage({ link }: { link: DeepLink }) {
  const docCode = link.code && !/^NCC/i.test(link.code) ? link.code : null;
  const { can } = useCurrentUser();
  const t = useT(purchasesNs);
  const [search, setSearch] = useState(docCode ? "" : (link.code ?? ""));
  const [q, setQ] = useState(search);
  const [linkDoc, setLinkDoc] = useState(docCode);
  const [filters, setFilters] = useState<SupplierFilters>(link.code ? { ...DEFAULT_SUPPLIER_FILTERS, status: "" } : DEFAULT_SUPPLIER_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(15);
  const [columns, setColumns] = useState<string[]>(defaultColumns);
  const [selected, setSelected] = useState<string[]>([]);
  const [dialog, setDialog] = useState<"create" | "import" | null>(null);
  const [exporting, setExporting] = useState(false);
  useEffect(() => { const timer = setTimeout(() => { setQ(search); setPage(0); }, 300); return () => clearTimeout(timer); }, [search]);
  useEffect(() => {
    try { const saved = JSON.parse(localStorage.getItem(COLUMNS_KEY) ?? "null"); if (Array.isArray(saved)) setColumns(saved); } catch { /* bỏ qua */ }
  }, []);
  const { data, isLoading } = useSupplierList(supplierParams(q, filters, page, size, linkDoc));
  const { open: expanded, setOpen: setExpanded } = useDeepLinkExpanded(data?.items, link, (s) => (docCode ? [docCode] : [s.code]));
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
        const res = await api<SupplierPage>(`/suppliers?${supplierParams(q, filters, p, 100, linkDoc)}`);
        rows.push(...res.items);
        if ((p + 1) * 100 >= res.total) break;
      }
      const out = selected.length ? rows.filter((s) => selected.includes(s.id)) : rows;
      downloadCsv("danh-sach-nha-cung-cap.csv", SUPPLIER_CSV_HEADER, out.map(supplierCsvRow));
    } catch {
      toast.error(t("suppliers.exportFailed"));
    } finally {
      setExporting(false);
    }
  }

  return (
    <PurchaseListLayout title={t("suppliers.title")}
      toolbar={<SupplierListToolbar search={search} onSearch={(v) => { setSearch(v); setLinkDoc(null); }} filtersOpen={filtersOpen} onToggleFilters={() => setFiltersOpen(!filtersOpen)}
        canManage={can("inventory.manage")} onCreate={() => setDialog("create")} onImport={() => setDialog("import")}
        onExport={exportCsv} exporting={exporting} columns={columns} onColumns={changeColumns} size={size}
        onSize={(n) => { setSize(n); setPage(0); }} />}
      sidebar={filtersOpen ? <SupplierFilterSidebar value={filters} onChange={(v) => { setFilters(v); setPage(0); setExpanded(null); setLinkDoc(null); }} /> : undefined}>
      <SupplierListTable data={data} loading={isLoading} columns={columns} expanded={expanded} onExpand={setExpanded}
        docCode={linkDoc && expanded === data?.items[0]?.id ? linkDoc : null}
        selected={selected} onSelect={setSelected} />
      <PurchaseListPager size={size} onSize={(n) => { setSize(n); setPage(0); }} page={page} pages={pages} total={data?.total ?? 0}
        unit={t("suppliers.unit")} onPage={(p) => { setPage(p); setExpanded(null); }} />
      {dialog === "create" && <SupplierFormDialog onClose={() => setDialog(null)} />}
      {dialog === "import" && <SupplierImportDialog onClose={() => setDialog(null)} />}
    </PurchaseListLayout>
  );
}

export default function Page() {
  return <DeepLinkRoute>{(link) => <SuppliersPage link={link} />}</DeepLinkRoute>;
}
