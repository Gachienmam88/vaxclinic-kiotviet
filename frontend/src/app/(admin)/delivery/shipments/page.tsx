"use client";

import Link from "next/link";
import { FileOutput, Plus } from "lucide-react";
import { DeepLinkRoute, type DeepLink } from "@/components/ui/deep-link-route";
import { Button } from "@/components/ui/button";
import { useShipments } from "@/features/delivery/delivery-queries";
import { ShipmentFilterSidebar, useShipmentListState } from "@/features/delivery/shipment-filter-sidebar";
import { exportShipments, ShipmentTable } from "@/features/delivery/shipment-table";
import { ListSearch, PageTitle, TOOLBAR_BTN } from "@/features/sales/invoice-list-kit";
import { ListPager } from "@/features/sales/invoice-list-pager";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { commonNs } from "@/messages/common";
import { deliveryNs } from "@/messages/delivery";

/**
 * Vận đơn: danh sách vận đơn lọc theo trạng thái giao hàng / thời gian / đối tác / khu vực, chi tiết + lịch sử trạng thái.
 * Vận đơn tạo ở màn bán hàng, chế độ "Bán giao hàng" (cùng hóa đơn). Link sâu: ?code=VD000001 (mọi thời gian + trạng thái, mở chi tiết).
 */
function ShipmentsPage({ link }: { link: DeepLink }) {
  const t = useT(deliveryNs);
  const tc = useT(commonNs);
  const st = useShipmentListState(["PENDING", "PICKING", "DELIVERING", "RETURNING"], link);
  const { data } = useShipments(st.params);

  return (
    <div className="flex gap-2.5">
      <div className="space-y-3">
        <PageTitle>{t("shipments.title")}</PageTitle>
        <ShipmentFilterSidebar value={st.filters} onChange={st.setFilters} showStatuses />
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex items-center gap-2">
          <ListSearch value={st.search} onChange={st.setSearch} placeholder={t("manage.searchPlaceholder")} />
          <Button variant="outline" className={cn(TOOLBAR_BTN, "ml-auto")} render={<Link href="/sale" />}
            title={t("shipments.newDeliveryHint")}><Plus className="size-4" /> {t("shipments.newDelivery")}</Button>
          <Button variant="outline" className={TOOLBAR_BTN} disabled={!data?.items.length} onClick={() => exportShipments(t, data)}>
            <FileOutput className="size-4" /> {tc("actions.export")}</Button>
        </div>
        <ShipmentTable data={data} link={link}
          onWiden={st.filters.period.mode === "month" ? () => st.setFilters({ ...st.filters, period: { ...st.filters.period, mode: "all" } }) : undefined} />
        <ListPager total={data?.total ?? 0} page={st.page} size={st.size} unit={t("manage.unit")} onPage={st.setPage} onSize={st.setSize} />
      </div>
    </div>
  );
}

export default function Page() {
  return <DeepLinkRoute>{(link) => <ShipmentsPage link={link} />}</DeepLinkRoute>;
}
