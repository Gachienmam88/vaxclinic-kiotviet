"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { InvoiceExportColumnDialog } from "@/features/sales/invoice-export-column-dialog";
import { FileJobsPanel, useFileJobs } from "@/features/sales/invoice-file-jobs-panel";
import { InvoiceImportDialog } from "@/features/sales/invoice-import-dialog";
import { InvoiceMergeDialog } from "@/features/sales/invoice-merge-dialog";
import { exportInvoiceDetail, exportInvoiceOverview } from "@/features/sales/invoice-xlsx-export";
import { DEEP_LINK_FILTERS, DEFAULT_FILTERS, EMPTY_SEARCH, invoiceListParams, type InvoiceSearch } from "@/features/sales/invoice-filter-model";
import { InvoiceFilterSidebar, type InvoiceFilters } from "@/features/sales/invoice-filter-sidebar";
import { PageTitle } from "@/features/sales/invoice-list-kit";
import { ListPager } from "@/features/sales/invoice-list-pager";
import { useInvoiceColumns, useInvoiceFavourites } from "@/features/sales/invoice-list-prefs";
import { InvoiceListTable } from "@/features/sales/invoice-list-table";
import { InvoiceListToolbar } from "@/features/sales/invoice-list-toolbar";
import { useInvoices } from "@/features/sales/sales-queries";
import { useT } from "@/lib/i18n";
import { useCurrentUser } from "@/lib/use-current-user";
import { salesNs } from "@/messages/sales";

/** Không có hóa đơn nào được đánh dấu: lọc theo id rỗng để server trả danh sách trống. */
const NO_ID = "00000000-0000-0000-0000-000000000000";

/**
 * Danh sách Hóa đơn (KiotViet /man/#/Invoices). Link sâu: /invoices?code=HD000123 (lọc theo mã, không phân biệt hoa thường, + mở chi tiết)
 * hoặc /invoices?id=<uuid> — mở từ màn bán hàng, Tổng quan... /invoices?einvoice=PUBLISHED,ACCEPTED (1 hoặc nhiều trạng thái, phẩy hoặc lặp tham số): lọc theo trạng thái HĐĐT, toàn thời gian
 * (Hồ sơ cửa hàng → Hóa đơn điện tử).
 */
function InvoicesPage({ code, id, einvoice }: { code: string | null; id: string | null; einvoice: string | null }) {
  const t = useT(salesNs);
  const deepLink = !!(code || id);
  const { data: me } = useCurrentUser();
  const fav = useInvoiceFavourites(me?.user.id);
  const columns = useInvoiceColumns(me?.user.id);
  const [search, setSearch] = useState<InvoiceSearch>({ ...EMPTY_SEARCH, q: code ?? "" });
  const [q, setQ] = useState(search);
  const [filters, setFilters] = useState<InvoiceFilters>(deepLink ? DEEP_LINK_FILTERS
    : einvoice ? { ...DEFAULT_FILTERS, time: { mode: "all" }, einvoiceStatus: einvoice } : DEFAULT_FILTERS);
  const [linkId, setLinkId] = useState(id);
  const [favOnly, setFavOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(15);
  // undefined = người dùng chưa mở / đóng dòng nào → mở sẵn hóa đơn của link sâu
  const [expanded, setExpanded] = useState<string | null | undefined>(id ?? undefined);
  const [dialog, setDialog] = useState<"import" | "exportColumns" | "merge" | null>(null);
  const jobs = useFileJobs();
  const branchId = me?.user.branches[0]?.id ?? "";
  useEffect(() => { const timer = setTimeout(() => { setQ(search); setPage(0); }, 300); return () => clearTimeout(timer); }, [search]);

  const ids = linkId ? [linkId] : favOnly ? (fav.ids.length ? fav.ids : [NO_ID]) : undefined;
  const params = useMemo(() => invoiceListParams(filters, q, page, size, ids), [filters, q, page, size, ids?.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const { data } = useInvoices(params);
  const open = expanded === undefined ? (data?.items.find((i) => i.code.toUpperCase() === code?.trim().toUpperCase())?.id ?? null) : expanded;

  const changeFilters = (f: InvoiceFilters) => { setFilters(f); setPage(0); setLinkId(null); };
  // Xuất file: mọi hóa đơn khớp bộ lọc + ô tìm kiếm hiện tại (không chỉ trang đang xem), tạo nền → panel góc phải dưới
  const exportFile = (kind: "summary" | "detail") => {
    if (kind === "detail") setDialog("exportColumns");
    else jobs.run(t("invoices.jobs.overview"), () => exportInvoiceOverview(params, columns.cols));
  };

  return (
    <div className="flex gap-2.5">
      <div className="space-y-3">
        <PageTitle>{t("invoices.title")}</PageTitle>
        <InvoiceFilterSidebar value={filters} onChange={changeFilters} />
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        <InvoiceListToolbar search={search} onSearch={(s) => { setSearch(s); setLinkId(null); }} onExport={exportFile}
          onImport={() => setDialog("import")} onMerge={() => setDialog("merge")}
          exportDisabled={!data?.items.length} shown={columns.shown} onToggleColumn={columns.toggle} />
        <div className="overflow-x-auto rounded-lg bg-background">
          <InvoiceListTable data={data} cols={columns.cols} expanded={open} onExpand={setExpanded} isFav={fav.isFav} onToggleFav={fav.toggle}
            favOnly={favOnly} onFavOnly={() => { setFavOnly(!favOnly); setPage(0); }}
            onWiden={filters.time.mode !== "all" ? () => changeFilters({ ...filters, time: { mode: "all" } }) : undefined} />
        </div>
        <ListPager total={data?.total ?? 0} page={page} size={size} unit={t("invoices.unit")} onPage={setPage} onSize={(s) => { setSize(s); setPage(0); }} />
      </div>
      {dialog === "import" && <InvoiceImportDialog branchId={branchId} onClose={() => setDialog(null)} />}
      {dialog === "merge" && <InvoiceMergeDialog branchId={branchId} onClose={() => setDialog(null)}
        onMerged={(inv) => { setDialog(null); setExpanded(inv.id); }} />}
      {dialog === "exportColumns" && <InvoiceExportColumnDialog onClose={() => setDialog(null)} onExport={(keys) => {
        setDialog(null);
        jobs.run(t("invoices.jobs.detail"), () => exportInvoiceDetail(params, keys));
      }} />}
      <FileJobsPanel jobs={jobs.jobs} onClose={jobs.clear} />
    </div>
  );
}

/** Đổi query (?code= / ?id=) khi đang ở trang → dựng lại trang với bộ lọc của link mới. */
function InvoicesRoute() {
  const sp = useSearchParams();
  return <InvoicesPage key={sp.toString()} code={sp.get("code") ?? sp.get("Code")} id={sp.get("id")} einvoice={sp.getAll("einvoice").join(",") || null} />;
}

export default function Page() {
  return <Suspense><InvoicesRoute /></Suspense>;
}
