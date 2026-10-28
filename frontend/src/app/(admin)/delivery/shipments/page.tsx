"use client";

import Link from "next/link";
import { FileOutput, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useShipments } from "@/features/delivery/delivery-queries";
import { ShipmentFilterSidebar, useShipmentListState } from "@/features/delivery/shipment-filter-sidebar";
import { exportShipments, ShipmentTable } from "@/features/delivery/shipment-table";
import { ListSearch, PageTitle, TOOLBAR_BTN } from "@/features/sales/invoice-list-kit";
import { ListPager } from "@/features/sales/invoice-list-pager";
import { cn } from "@/lib/utils";

/**
 * Vận đơn: danh sách vận đơn lọc theo trạng thái giao hàng / thời gian / đối tác / khu vực, chi tiết + lịch sử trạng thái.
 * Vận đơn tạo ở màn bán hàng, chế độ "Bán giao hàng" (cùng hóa đơn).
 */
export default function ShipmentsPage() {
  const st = useShipmentListState(["PENDING", "PICKING", "DELIVERING", "RETURNING"]);
  const { data } = useShipments(st.params);

  return (
    <div className="flex gap-2.5">
      <div className="space-y-3">
        <PageTitle>Vận đơn</PageTitle>
        <ShipmentFilterSidebar value={st.filters} onChange={st.setFilters} showStatuses />
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex items-center gap-2">
          <ListSearch value={st.search} onChange={st.setSearch} placeholder="Theo mã vận đơn, mã hóa đơn, người nhận, SĐT" />
          <Button variant="outline" className={cn(TOOLBAR_BTN, "ml-auto")} render={<Link href="/pos" />}
            title="Mở màn bán hàng, chọn chế độ Bán giao hàng ở thanh dưới cùng"><Plus className="size-4" /> Bán giao hàng</Button>
          <Button variant="outline" className={TOOLBAR_BTN} disabled={!data?.items.length} onClick={() => exportShipments(data)}>
            <FileOutput className="size-4" /> Xuất file</Button>
        </div>
        <ShipmentTable data={data} />
        <ListPager total={data?.total ?? 0} page={st.page} size={st.size} unit="vận đơn" onPage={st.setPage} onSize={st.setSize} />
      </div>
    </div>
  );
}
