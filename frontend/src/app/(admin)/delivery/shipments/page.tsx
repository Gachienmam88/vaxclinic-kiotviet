"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { HandCoins, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DeepLinkRoute, type DeepLink } from "@/components/ui/deep-link-route";
import { useShipments } from "@/features/delivery/delivery-queries";
import { DeliveryToolbarRight, useShownColumns } from "@/features/delivery/delivery-list-toolbar";
import { ReconcileDialog } from "@/features/delivery/reconcile-dialog";
import { ShipmentBulkBar } from "@/features/delivery/shipment-bulk-bar";
import { ShipmentFilterSidebar, useShipmentListState, type ShipmentFilters } from "@/features/delivery/shipment-filter-sidebar";
import { DEFAULT_SHIPMENT_COLUMNS, SHIPMENT_COLUMNS } from "@/features/delivery/shipment-list-columns";
import { ShipmentTable } from "@/features/delivery/shipment-table";
import { exportShipmentsXlsx } from "@/features/delivery/shipment-xlsx-export";
import { ListSearch, PageTitle, TOOLBAR_BTN } from "@/features/sales/invoice-list-kit";
import { ListPager } from "@/features/sales/invoice-list-pager";
import { errorMessage } from "@/lib/api-client";
import { useT } from "@/lib/i18n";
import { useCurrentUser } from "@/lib/use-current-user";
import { deliveryNs } from "@/messages/delivery";

const HELP = "https://www.kiotviet.vn/huong-dan-su-dung-kiotviet/retail-giao-van/";

/** Bộ lọc mở từ Quản lý giao hàng "Xem chi tiết": ?statuses=A,B&partnerId=&connection=&createdFrom=yyyy-MM-dd&createdTo=. */
function initialFilters(sp: URLSearchParams): Partial<ShipmentFilters> {
  const out: Partial<ShipmentFilters> = {};
  if (sp.get("statuses")) out.statuses = sp.get("statuses")!.split(",").filter(Boolean);
  if (sp.get("partnerId")) out.partnerId = sp.get("partnerId")!;
  if (sp.get("connection")) out.connection = sp.get("connection")!;
  const from = sp.get("createdFrom"), to = sp.get("createdTo");
  if (from && to) out.created = { mode: "custom", from, to };
  return out;
}

/**
 * Vận đơn (KiotViet): tìm "Theo mã vận đơn", Xuất file (xlsx theo bộ lọc + cột đang hiện), chọn cột, thiết lập, hướng dẫn;
 * lọc trạng thái / đối tác / thời gian tạo / hoàn thành / khu vực / thu hộ; chọn nhiều → cập nhật trạng thái; Đối soát thu hộ.
 * Link sâu ?code=VD000001 mở chi tiết.
 */
function ShipmentsPage({ link }: { link: DeepLink }) {
  const t = useT(deliveryNs);
  const { can } = useCurrentUser();
  const sp = useSearchParams();
  const st = useShipmentListState(link, initialFilters(new URLSearchParams(sp.toString())));
  const { data } = useShipments(st.params);
  const cols = useShownColumns("delivery.shipments.columns", DEFAULT_SHIPMENT_COLUMNS);
  const [selected, setSelected] = useState<string[]>([]);
  const [reconcile, setReconcile] = useState(false);
  const [exporting, setExporting] = useState(false);
  const exportFile = async () => {
    setExporting(true);
    try { await exportShipmentsXlsx(t, st.params, cols.shown); } catch (e) { toast.error(errorMessage(e)); } finally { setExporting(false); }
  };
  const change = (f: ShipmentFilters) => { st.setFilters(f); setSelected([]); };

  return (
    <div className="flex gap-2.5">
      <div className="space-y-3">
        <PageTitle>{t("kv.list.title")}</PageTitle>
        <ShipmentFilterSidebar value={st.filters} onChange={change} />
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <ListSearch value={st.search} onChange={st.setSearch} placeholder={t("kv.list.search")} />
            <SlidersHorizontal className="pointer-events-none absolute top-2 right-2.5 size-4 text-muted-foreground" aria-hidden />
          </div>
          {can("sales.perform") && <Button variant="outline" className={TOOLBAR_BTN} onClick={() => setReconcile(true)}
            title={t("manage.reconcileHint")}><HandCoins className="size-4" /> {t("partner.reconcile")}</Button>}
          <DeliveryToolbarRight onExport={exportFile} exportDisabled={!data?.items.length} exporting={exporting} helpUrl={HELP}
            columns={SHIPMENT_COLUMNS.map((c) => [c, t(`kv.cols.${c}`)] as const)} shown={cols.shown} onToggle={cols.toggle} />
        </div>
        {can("sales.perform") && <ShipmentBulkBar selected={selected} onDone={() => setSelected([])} />}
        <ShipmentTable data={data} link={link} shown={cols.shown} selected={can("sales.perform") ? selected : undefined}
          onSelect={can("sales.perform") ? setSelected : undefined}
          onWiden={st.filters.created.mode !== "all" ? () => change({ ...st.filters, created: { mode: "all" } }) : undefined} />
        <ListPager total={data?.total ?? 0} page={st.page} size={st.size} unit={t("manage.unit")} onPage={st.setPage} onSize={st.setSize} />
      </div>
      {reconcile && <ReconcileDialog partnerId={st.filters.partnerId || undefined} onClose={() => setReconcile(false)} />}
    </div>
  );
}

export default function Page() {
  return <DeepLinkRoute>{(link) => <ShipmentsPage link={link} />}</DeepLinkRoute>;
}
