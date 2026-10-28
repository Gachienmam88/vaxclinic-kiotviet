"use client";

import { useState } from "react";
import { FileOutput, HandCoins } from "lucide-react";
import { DeepLinkRoute, type DeepLink } from "@/components/ui/deep-link-route";
import { Button } from "@/components/ui/button";
import { SHIPMENT_STATUS_KEY, SHIPMENT_STATUSES, type ShipmentStatus } from "@/features/delivery/delivery-types";
import { useShipments } from "@/features/delivery/delivery-queries";
import { ReconcileDialog } from "@/features/delivery/reconcile-dialog";
import { ShipmentFilterSidebar, useShipmentListState } from "@/features/delivery/shipment-filter-sidebar";
import { ShipmentReturnedDialog } from "@/features/delivery/shipment-returned-dialog";
import { exportShipments, ShipmentTable } from "@/features/delivery/shipment-table";
import { confirmStatus, useShipmentStatus } from "@/features/delivery/use-shipment-status";
import { FILTER_FIELD, ListSearch, PageTitle, TOOLBAR_BTN } from "@/features/sales/invoice-list-kit";
import { ListPager } from "@/features/sales/invoice-list-pager";
import { useT } from "@/lib/i18n";
import { renderRichText } from "@/lib/i18n/render-rich-text";
import { useCurrentUser } from "@/lib/use-current-user";
import { cn } from "@/lib/utils";
import { commonNs } from "@/messages/common";
import { deliveryNs } from "@/messages/delivery";

/**
 * Quản lý giao hàng (KiotViet): thanh trạng thái có số đếm, lọc thời gian / đối tác / khu vực / đối soát,
 * bảng vận đơn chọn nhiều → cập nhật trạng thái hàng loạt, "Đối soát" thu hộ với đối tác → 1 phiếu thu/chi Sổ quỹ.
 * Trạng thái cập nhật tay (chưa tích hợp API GHN / GHTK...). Link sâu: ?code=VD000001 như trang Vận đơn.
 */
function DeliveryPage({ link }: { link: DeepLink }) {
  const t = useT(deliveryNs);
  const tc = useT(commonNs);
  const { can } = useCurrentUser();
  const st = useShipmentListState([], link);
  const { data } = useShipments(st.params);
  const [selected, setSelected] = useState<string[]>([]);
  const [target, setTarget] = useState<ShipmentStatus | "">("");
  const [reconcile, setReconcile] = useState(false);
  const [returnedDialog, setReturnedDialog] = useState(false);
  const status = useShipmentStatus(() => { setSelected([]); setTarget(""); setReturnedDialog(false); });
  const counts = data?.statusCounts;
  const total = counts ? Object.values(counts).reduce((s, n) => s + n, 0) : 0;
  const active = st.filters.statuses[0] ?? "";
  const tab = (key: string, label: string, n: number) => (
    <button key={key} type="button" aria-pressed={active === key} onClick={() => { st.setFilters({ ...st.filters, statuses: key ? [key] : [] }); setSelected([]); }}
      className={cn("relative h-10 px-1 text-[13px] font-medium whitespace-nowrap", active === key ? "text-primary" : "text-foreground")}>
      {label} <span className={cn("ml-1 rounded-full px-1.5 text-xs", active === key ? "bg-primary text-white" : "bg-[#eff0f3]")}>{n}</span>
      {active === key && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" />}
    </button>
  );
  const apply = () => target === "RETURNED" ? setReturnedDialog(true)
    : target && confirmStatus(t, target, selected.length) && status.mutate({ ids: selected, status: target });

  return (
    <div className="flex gap-2.5">
      <div className="space-y-3">
        <PageTitle>{t("manage.title")}</PageTitle>
        <ShipmentFilterSidebar value={st.filters} onChange={(f) => { st.setFilters(f); setSelected([]); }} />
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex items-center gap-2">
          <ListSearch value={st.search} onChange={st.setSearch} placeholder={t("manage.searchPlaceholder")} />
          {can("sales.perform") && <Button variant="outline" className={cn(TOOLBAR_BTN, "ml-auto")} onClick={() => setReconcile(true)}
            title={t("manage.reconcileHint")}><HandCoins className="size-4" /> {t("partner.reconcile")}</Button>}
          <Button variant="outline" className={cn(TOOLBAR_BTN, !can("sales.perform") && "ml-auto")} disabled={!data?.items.length}
            onClick={() => exportShipments(t, data)}><FileOutput className="size-4" /> {tc("actions.export")}</Button>
        </div>
        <div className="flex gap-5 overflow-x-auto rounded-lg bg-background px-4">
          {tab("", tc("status.all"), total)}
          {SHIPMENT_STATUSES.map(([k]) => tab(k, t(SHIPMENT_STATUS_KEY[k]), counts?.[k] ?? 0))}
        </div>
        {selected.length > 0 && can("sales.perform") && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-primary-tint px-4 py-2 text-[13px]">
            <span>{renderRichText(t("manage.selected"), { n: <b>{selected.length}</b> })}</span>
            <select aria-label={t("manage.bulkAria")} className={cn(FILTER_FIELD, "w-52")} value={target} onChange={(e) => setTarget(e.target.value as ShipmentStatus)}>
              <option value="">{t("manage.bulkPlaceholder")}</option>
              {SHIPMENT_STATUSES.map(([k]) => <option key={k} value={k}>{t(SHIPMENT_STATUS_KEY[k])}</option>)}
            </select>
            <Button size="sm" disabled={!target || status.isPending} onClick={apply}>{tc("actions.update")}</Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected([])}>{tc("actions.clearSelection")}</Button>
          </div>)}
        <ShipmentTable data={data} selected={selected} onSelect={setSelected} link={link}
          onWiden={st.filters.period.mode === "month" ? () => st.setFilters({ ...st.filters, period: { ...st.filters.period, mode: "all" } }) : undefined} />
        <ListPager total={data?.total ?? 0} page={st.page} size={st.size} unit={t("manage.unit")} onPage={st.setPage} onSize={st.setSize} />
      </div>
      {returnedDialog && <ShipmentReturnedDialog count={selected.length} pending={status.isPending} onClose={() => setReturnedDialog(false)}
        onSubmit={(opts) => status.mutate({ ids: selected, status: "RETURNED", opts })} />}
      {reconcile && <ReconcileDialog partnerId={st.filters.partnerId || undefined} onClose={() => setReconcile(false)} />}
    </div>
  );
}

export default function Page() {
  return <DeepLinkRoute>{(link) => <DeliveryPage link={link} />}</DeepLinkRoute>;
}
