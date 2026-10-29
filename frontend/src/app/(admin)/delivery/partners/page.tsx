"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DeepLinkRoute, type DeepLink } from "@/components/ui/deep-link-route";
import { usePartners, useShipments } from "@/features/delivery/delivery-queries";
import type { DeliveryPartner, PartnerList } from "@/features/delivery/delivery-types";
import { DeliveryToolbarRight, useShownColumns } from "@/features/delivery/delivery-list-toolbar";
import { downloadXlsx } from "@/features/delivery/delivery-xlsx";
import { PartnerFormDialog } from "@/features/delivery/partner-form-dialog";
import { PARTNER_COLUMNS, PartnerListTable, partnerValue, type PartnerColumn } from "@/features/delivery/partner-list-table";
import { PartnerSettlementHistory } from "@/features/delivery/partner-settlement-history";
import { PartnerSideCard, type PartnerSideTab } from "@/features/delivery/partner-side-card";
import { PartnersEmpty } from "@/features/delivery/partners-empty";
import { ShipmentTable } from "@/features/delivery/shipment-table";
import { useSettlementOwner } from "@/features/delivery/use-settlement-owner";
import { ListSearch, PageTitle, TOOLBAR_BTN } from "@/features/sales/invoice-list-kit";
import { ListPager } from "@/features/sales/invoice-list-pager";
import { api, errorMessage } from "@/lib/api-client";
import { useT } from "@/lib/i18n";
import { useCurrentUser } from "@/lib/use-current-user";
import { cn } from "@/lib/utils";
import { deliveryNs } from "@/messages/delivery";

const HELP = "https://www.kiotviet.vn/huong-dan-su-dung-kiotviet/retail-giao-van/quan-ly-doi-tac-giao-hang/#iii-quan-ly-doi-tac-giao-hang-rieng-cua-cua-hang";
type MainTab = "info" | "history" | "settlements";

/**
 * Đối tác giao hàng (KiotViet): thẻ trái Tích hợp (chưa có hãng tích hợp → trống) / Khác (đối tác cửa hàng); tab Thông tin
 * (7 cột tính từ vận đơn), Lịch sử giao hàng (vận đơn mọi đối tác), Lịch sử đối soát. Xuất file xlsx, chọn cột, thiết lập, hướng dẫn.
 * Link sâu ?code=DT000001 (mở đối tác) hoặc ?code=DS000001 (mở đối tác sở hữu phiếu → tab thanh toán).
 */
function DeliveryPartnersPage({ link }: { link: DeepLink }) {
  const t = useT(deliveryNs);
  const { can } = useCurrentUser();
  const settlementCode = link.code && /^DS\d/i.test(link.code) ? link.code : null;
  const [side, setSide] = useState<PartnerSideTab>(link.code ? "other" : "other");
  const [tab, setTab] = useState<MainTab>("info");
  const [search, setSearch] = useState(settlementCode ? "" : link.code ?? "");
  const [q, setQ] = useState(settlementCode ? "" : link.code ?? "");
  const [active, setActive] = useState("");
  const [debt, setDebt] = useState("");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(15);
  const [creating, setCreating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const cols = useShownColumns<PartnerColumn>("delivery.partners.columns", PARTNER_COLUMNS);
  useEffect(() => { const h = setTimeout(() => { setQ(search); setPage(0); }, 300); return () => clearTimeout(h); }, [search]);
  const params = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), size: String(size) });
    if (q) p.set("q", q);
    if (active) p.set("active", active);
    if (debt) p.set("debt", debt);
    return p;
  }, [q, active, debt, page, size]);
  const { data } = usePartners(params);
  const list = side === "integrated" ? undefined : data;
  const owner = useSettlementOwner(settlementCode, data?.items.map((p) => p.id) ?? []);
  const [shipPage, setShipPage] = useState(0);
  const shipParams = useMemo(() => new URLSearchParams({ page: String(shipPage), size: "15" }), [shipPage]);
  const shipments = useShipments(shipParams);
  const exportFile = async () => {
    setExporting(true);
    try {
      const all: DeliveryPartner[] = [];
      for (let pg = 0; ; pg++) {
        const p = new URLSearchParams(params); p.set("page", String(pg)); p.set("size", "200");
        const r = await api<PartnerList>(`/delivery-partners?${p}`);
        all.push(...r.items);
        if (all.length >= r.total || !r.items.length) break;
      }
      const shown = PARTNER_COLUMNS.filter(cols.shown);
      await downloadXlsx(t("kv.partners.file"), shown.map((c) => t(`kv.partners.${c}`)), all.map((p) => shown.map((c) => partnerValue(p, c))),
        shown.map((c) => c !== "code" && c !== "name" && c !== "total"));
    } catch (e) { toast.error(errorMessage(e)); } finally { setExporting(false); }
  };
  const mainTab = (k: MainTab, label: string) => (
    <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
      className={cn("relative h-9 text-[13px]", tab === k ? "text-primary" : "text-foreground")}>{label}
      {tab === k && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" />}</button>);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <PageTitle>{t("partners.title")}</PageTitle>
        {side === "other" && tab === "info" && <div className="ml-6"><ListSearch value={search} onChange={setSearch} placeholder={t("partners.searchPlaceholder")} /></div>}
        <div className="ml-auto flex items-center gap-2">
          {can("sales.perform") && <Button variant="outline" className={TOOLBAR_BTN} onClick={() => setCreating(true)}><Plus className="size-4" /> {t("partners.new")}</Button>}
          <DeliveryToolbarRight onExport={exportFile} exportDisabled={!list?.items.length} exporting={exporting} helpUrl={HELP}
            columns={PARTNER_COLUMNS.map((c) => [c, t(`kv.partners.${c}`)] as const)} shown={cols.shown} onToggle={cols.toggle} />
        </div>
      </div>
      <div className="flex gap-2.5">
        <PartnerSideCard tab={side} onTab={setSide} active={active} onActive={(v) => { setActive(v); setPage(0); }}
          debt={debt} onDebt={(v) => { setDebt(v); setPage(0); }} />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex gap-6 px-1" role="tablist">
            {mainTab("info", t("kv.partners.info"))}{mainTab("history", t("kv.partners.history"))}{mainTab("settlements", t("kv.partners.settlements"))}
          </div>
          <div className="overflow-x-auto rounded-lg bg-background">
            {tab === "info" && (side === "integrated"
              ? <PartnersEmpty cols={PARTNER_COLUMNS.filter(cols.shown).map((c) => t(`kv.partners.${c}`))} />
              : <PartnerListTable data={list} shown={cols.shown} link={link} owner={owner} />)}
            {tab === "history" && (side === "integrated" ? <PartnersEmpty cols={[t("kv.cols.waybill"), t("kv.cols.partner")]} />
              : <ShipmentTable data={shipments.data} compact />)}
            {tab === "settlements" && (side === "integrated" ? <PartnersEmpty cols={[t("kv.partners.stlCode"), t("kv.partners.stlPartner")]} />
              : <PartnerSettlementHistory />)}
          </div>
          {tab === "info" && side === "other" && !!list?.items.length && <ListPager total={list.total} page={page} size={size}
            unit={t("partners.unit")} onPage={setPage} onSize={(s) => { setSize(s); setPage(0); }} />}
          {tab === "history" && side === "other" && !!shipments.data?.items.length && <ListPager total={shipments.data.total} page={shipPage}
            size={15} unit={t("manage.unit")} onPage={setShipPage} onSize={() => undefined} />}
        </div>
      </div>
      {creating && <PartnerFormDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

export default function Page() {
  return <DeepLinkRoute>{(link) => <DeliveryPartnersPage link={link} />}</DeepLinkRoute>;
}
