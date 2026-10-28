"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FileOutput, FileUp, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useInputInvoices, useTaxConnections, NATURE_LABEL, type TaxConnection } from "@/features/integrations/integration-queries";
import { InputInvoiceFilterSidebar, inputInvoiceParams, type InputInvoiceFilters } from "@/features/integrations/input-invoice-filter-sidebar";
import { InputInvoiceTable } from "@/features/integrations/input-invoice-table";
import { SyncDialog, TaxConnectionDialog } from "@/features/integrations/tax-connection-dialogs";
import { TaxConnectionList } from "@/features/integrations/tax-connection-list";
import { DETAIL_TAB, ListSearch, PageTitle, TOOLBAR_BTN } from "@/features/sales/invoice-list-kit";
import { downloadCsv, ListPager } from "@/features/sales/invoice-list-pager";
import { formatDate } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { purchasesNs } from "@/messages/purchases";

export default function InputInvoicesPage() {
  const qc = useQueryClient();
  const t = useT(purchasesNs);
  const tc = useT(commonNs);
  const { data: connections = [] } = useTaxConnections();
  const [tab, setTab] = useState("invoices");
  const [dialog, setDialog] = useState<{ edit?: TaxConnection } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [filters, setFilters] = useState<InputInvoiceFilters>({ period: { mode: "all", from: "", to: "" }, buyer: "", seller: "", statuses: [] });
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(15);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { const timer = setTimeout(() => { setQ(search); setPage(0); }, 300); return () => clearTimeout(timer); }, [search]);
  const params = useMemo(() => {
    const p = inputInvoiceParams(filters, new URLSearchParams({ page: String(page), size: String(size) }));
    if (q) p.set("q", q);
    return p;
  }, [filters, q, page, size]);
  const { data } = useInputInvoices(params);

  async function importXml(files: FileList | null) {
    if (!files?.length) return;
    const form = new FormData();
    Array.from(files).forEach((file) => form.append("files", file));
    const res = await fetch("/api/backend/input-invoices/import", { method: "POST", body: form });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return toast.error(body.message ?? t("inputInvoices.importFailed"));
    toast.success(t("inputInvoices.toastImported", { files: body.files, added: body.added }));
    body.errors?.forEach((e: string) => toast.error(e));
    qc.invalidateQueries({ queryKey: ["input-invoices"] });
    if (fileRef.current) fileRef.current.value = "";
  }
  // CSV hóa đơn đầu vào = dữ liệu thuế → tiêu đề/giá trị giữ tiếng Việt ở mọi ngôn ngữ
  const exportCsv = () => downloadCsv("hoa-don-dau-vao", ["Ký hiệu", "Số hóa đơn", "Ngày hóa đơn", "Nhà cung cấp", "MST người bán", "MST người mua",
    "Tổng tiền", "Trạng thái lập phiếu", "Tính chất"], (data?.items ?? []).map((i) => [`${i.templateNo}${i.series}`, i.number, formatDate(i.issuedAt),
    i.sellerName, i.sellerTaxCode, i.buyerTaxCode, i.total, i.receiptId ? `Đã lập phiếu ${i.receiptCode ?? ""}` : "Chưa lập phiếu", NATURE_LABEL[i.nature]]));

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <PageTitle sub={t("inputInvoices.subtitle")}>{t("inputInvoices.title")}</PageTitle>
        <div className="ml-auto flex gap-2">
          {tab === "connections"
            ? <Button variant="outline" className={TOOLBAR_BTN} onClick={() => setDialog({})}><Plus className="size-4" /> {t("inputInvoices.addConnection")}</Button>
            : <>
              <Button variant="outline" className={TOOLBAR_BTN} disabled={!connections.length} onClick={() => setSyncing(true)}>
                <RefreshCw className="size-4" /> {t("inputInvoices.sync")}</Button>
              <Button variant="outline" className={TOOLBAR_BTN} onClick={() => fileRef.current?.click()}><FileUp className="size-4" /> {t("inputInvoices.importXml")}</Button>
              <Button variant="outline" className={TOOLBAR_BTN} disabled={!data?.items.length} onClick={exportCsv}
                title={t("inputInvoices.exportTitle")}><FileOutput className="size-4" /> {tc("actions.export")}</Button>
              <input ref={fileRef} type="file" accept=".xml" multiple hidden onChange={(e) => importXml(e.target.files)} />
            </>}
        </div>
      </div>
      <Tabs value={tab} onValueChange={(v) => setTab(String(v))} className="gap-3">
        <TabsList variant="line" className="w-full justify-start gap-6 rounded-none border-b px-3 py-0 group-data-horizontal/tabs:h-9">
          <TabsTrigger value="connections" className={DETAIL_TAB}>{t("inputInvoices.tabConnections", { n: connections.length })}</TabsTrigger>
          <TabsTrigger value="invoices" className={DETAIL_TAB}>{t("inputInvoices.tabInvoices", { n: data?.total ?? 0 })}</TabsTrigger>
        </TabsList>
        <TabsContent value="connections"><TaxConnectionList onEdit={(c) => setDialog({ edit: c })} /></TabsContent>
        <TabsContent value="invoices" className="flex gap-2.5">
          <InputInvoiceFilterSidebar value={filters} onChange={(f) => { setFilters(f); setPage(0); }} />
          <div className="min-w-0 flex-1 space-y-2.5">
            <ListSearch value={search} onChange={setSearch} placeholder={t("inputInvoices.search")} />
            <InputInvoiceTable items={data?.items} sumTotal={data?.sumTotal ?? 0} />
            <ListPager total={data?.total ?? 0} page={page} size={size} unit={t("inputInvoices.unit")} onPage={setPage} onSize={(n) => { setSize(n); setPage(0); }} />
          </div>
        </TabsContent>
      </Tabs>
      {dialog && <TaxConnectionDialog connection={dialog.edit} onClose={() => setDialog(null)} />}
      {syncing && <SyncDialog connections={connections} onClose={() => setSyncing(false)} />}
    </div>
  );
}
