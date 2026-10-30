"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FileOutput, FileUp, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useInputInvoices, useTaxConnections, type InputInvoice, type TaxConnection } from "@/features/integrations/integration-queries";
import {
  DEFAULT_INPUT_INVOICE_FILTERS, InputInvoiceFilterSidebar, inputInvoiceParams, type InputInvoiceFilters,
} from "@/features/integrations/input-invoice-filter-sidebar";
import { InputInvoiceTable } from "@/features/integrations/input-invoice-table";
import type { CreateKind } from "@/features/integrations/input-invoice-create-menu";
import { InputInvoiceCreateFlow } from "@/features/integrations/input-invoice-create-flow";
import { InputInvoiceDetailDialog } from "@/features/integrations/input-invoice-detail-dialog";
import { exportInputInvoicesXlsx } from "@/features/integrations/input-invoice-export";
import { InputInvoiceHelp } from "@/features/integrations/input-invoice-help";
import { SyncDialog } from "@/features/integrations/sync-dialog";
import { TaxConnectionDialog } from "@/features/integrations/tax-connection-dialogs";
import { TaxConnectionList } from "@/features/integrations/tax-connection-list";
import { DETAIL_TAB, ListSearch, PageTitle, TOOLBAR_BTN } from "@/features/sales/invoice-list-kit";
import { ListPager } from "@/features/sales/invoice-list-pager";
import { errorMessage } from "@/lib/api-client";
import { useT } from "@/lib/i18n";
import { inputInvoicesNs } from "@/messages/input-invoices";

/** Hóa đơn đầu vào (KiotViet): Danh sách kết nối cổng thuế + Danh sách hóa đơn (đồng bộ / nhập XML → lập phiếu). */
export default function InputInvoicesPage() {
  const qc = useQueryClient();
  const t = useT(inputInvoicesNs);
  const { data: connections = [] } = useTaxConnections();
  const [tab, setTab] = useState("invoices");
  const [dialog, setDialog] = useState<{ edit?: TaxConnection } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [filters, setFilters] = useState<InputInvoiceFilters>(DEFAULT_INPUT_INVOICE_FILTERS);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(15);
  const [selected, setSelected] = useState<string[]>([]);
  const [viewing, setViewing] = useState<string | null>(null);
  const [creating, setCreating] = useState<{ inv: InputInvoice; kind: CreateKind } | null>(null);
  const [exporting, setExporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { const timer = setTimeout(() => { setQ(search); setPage(0); }, 300); return () => clearTimeout(timer); }, [search]);
  const filterParams = useMemo(() => {
    const p = inputInvoiceParams(filters);
    if (q) p.set("q", q);
    return p;
  }, [filters, q]);
  const params = useMemo(() => {
    const p = new URLSearchParams(filterParams);
    p.set("page", String(page));
    p.set("size", String(size));
    return p;
  }, [filterParams, page, size]);
  const { data } = useInputInvoices(params);

  async function importXml(files: FileList | null) {
    if (!files?.length) return;
    const form = new FormData();
    Array.from(files).forEach((file) => form.append("files", file));
    const res = await fetch("/api/backend/input-invoices/import", { method: "POST", body: form });
    const body = await res.json().catch(() => ({}));
    if (fileRef.current) fileRef.current.value = "";
    if (!res.ok) return toast.error(body.message ?? t("page.importFailed"));
    toast.success(t("page.toastImported", { files: body.files, added: body.added }));
    body.errors?.forEach((e: string) => toast.error(e));
    ["input-invoices", "input-invoice-sellers", "input-invoice-buyers"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  }

  async function exportXlsx() {
    setExporting(true);
    try {
      const n = await exportInputInvoicesXlsx(filterParams);
      if (!n) toast.info(t("page.exportEmpty"));
    } catch (e) { toast.error(errorMessage(e)); } finally { setExporting(false); }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <PageTitle sub={t("page.subtitle")}>{t("page.title")}</PageTitle>
        <div className="ml-auto flex gap-2">
          {tab === "connections"
            ? <Button variant="outline" className={TOOLBAR_BTN} onClick={() => setDialog({})}><Plus className="size-4" /> {t("page.addConnection")}</Button>
            : <>
              <Button variant="outline" className={TOOLBAR_BTN} disabled={!connections.length} title={connections.length ? undefined : t("page.needConnection")}
                onClick={() => setSyncing(true)}><RefreshCw className="size-4" /> {t("page.sync")}</Button>
              <Button variant="outline" className="h-[30px] rounded-md px-2.5" onClick={() => fileRef.current?.click()}>
                <FileUp className="size-4" /> {t("page.importXml")}</Button>
              <Button variant="outline" className="h-[30px] rounded-md px-2.5" disabled={exporting} onClick={exportXlsx}>
                <FileOutput className="size-4" /> {t("page.export")}</Button>
              <input ref={fileRef} type="file" accept=".xml" multiple hidden onChange={(e) => importXml(e.target.files)} />
            </>}
          <InputInvoiceHelp />
        </div>
      </div>
      <Tabs value={tab} onValueChange={(v) => setTab(String(v))} className="gap-3">
        <TabsList variant="line" className="w-full justify-start gap-6 rounded-none border-b px-3 py-0 group-data-horizontal/tabs:h-9">
          <TabsTrigger value="connections" className={DETAIL_TAB}>{t("page.tabConnections", { n: connections.length })}</TabsTrigger>
          <TabsTrigger value="invoices" className={DETAIL_TAB}>{t("page.tabInvoices", { n: data?.total ?? 0 })}</TabsTrigger>
        </TabsList>
        <TabsContent value="connections"><TaxConnectionList onEdit={(c) => setDialog({ edit: c })} /></TabsContent>
        <TabsContent value="invoices" className="flex gap-2.5">
          <InputInvoiceFilterSidebar value={filters} onChange={(f) => { setFilters(f); setPage(0); }} />
          <div className="min-w-0 flex-1 space-y-2.5">
            <ListSearch value={search} onChange={setSearch} placeholder={t("page.search")} />
            <InputInvoiceTable items={data?.items} selected={selected} onSelect={setSelected} onView={(i) => setViewing(i.id)}
              onCreate={(inv, kind) => setCreating({ inv, kind })} />
            <ListPager total={data?.total ?? 0} page={page} size={size} unit={t("page.unit")} onPage={setPage} onSize={(n) => { setSize(n); setPage(0); }} />
          </div>
        </TabsContent>
      </Tabs>
      {dialog && <TaxConnectionDialog connection={dialog.edit} onClose={() => setDialog(null)} />}
      {syncing && <SyncDialog connections={connections} onClose={() => setSyncing(false)} />}
      {viewing && <InputInvoiceDetailDialog id={viewing} onClose={() => setViewing(null)} />}
      {creating && <InputInvoiceCreateFlow inv={creating.inv} kind={creating.kind} onClose={() => setCreating(null)} />}
    </div>
  );
}
