"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { DeliveryCashflow } from "@/features/delivery/delivery-cashflow";
import { DeliveryDashboardFilters, DEFAULT_DASH, dashParams, dashRange, type DashFilters } from "@/features/delivery/delivery-dashboard-filters";
import { DeliveryDashboardStats } from "@/features/delivery/delivery-dashboard-stats";
import { useShipmentCashflow, useShipmentDashboard } from "@/features/delivery/delivery-queries";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { deliveryNs } from "@/messages/delivery";

/**
 * Quản lý giao hàng (KiotViet): QUẢN LÝ (Thống kê / Dòng tiền) + bộ lọc hình thức kết nối, đối tác, thời gian tạo đơn;
 * "⟳ Cập nhật lúc HH:mm" tải lại số liệu. Bấm thẻ / dòng trạng thái → Vận đơn đã lọc. Chưa tích hợp hãng vận chuyển nên
 * không có thẻ "điều chỉnh cước" và các cột bồi hoàn / giao thất bại thu tiền.
 */
export default function DeliveryManagementPage() {
  const t = useT(deliveryNs);
  const qc = useQueryClient();
  const [view, setView] = useState<"stats" | "cashflow">("stats");
  const [filters, setFilters] = useState<DashFilters>(DEFAULT_DASH);
  const params = dashParams(filters);
  const dash = useShipmentDashboard(params);
  const cash = useShipmentCashflow(params, view === "cashflow");
  const updated = new Date(Math.max(dash.dataUpdatedAt, cash.dataUpdatedAt) || Date.now());
  const refresh = () => qc.invalidateQueries({ queryKey: ["shipments"] });
  const detailHref = (statuses?: string[]) => {
    const r = dashRange(filters);
    const p = new URLSearchParams({ createdFrom: r.from, createdTo: r.to });
    if (statuses?.length) p.set("statuses", statuses.join(","));
    if (filters.partner && filters.partner !== "OTHER") p.set("partnerId", filters.partner);
    if (filters.connection || filters.partner === "OTHER") p.set("connection", "MANUAL");
    return `/delivery/shipments?${p}`;
  };
  const nav = (k: "stats" | "cashflow") => (
    <button type="button" onClick={() => setView(k)} aria-pressed={view === k}
      className={cn("block h-9 w-full rounded-md px-3 text-left text-[13px]", view === k ? "bg-[#e8f1fd] text-[#2171bc]" : "hover:bg-muted")}>
      {t(`kv.dash.${k}`)}</button>);

  return (
    <div className="space-y-3">
      <div className="flex items-center">
        <Link href="/delivery/shipments" className="flex items-center gap-1 text-[18px] font-bold"><ChevronLeft className="size-5" />{t("kv.dash.title")}</Link>
        <button type="button" onClick={refresh} className="ml-auto flex items-center gap-1 text-[13px] text-muted-foreground hover:text-primary">
          <RefreshCw className={cn("size-3.5", (dash.isFetching || cash.isFetching) && "animate-spin")} />
          {t("kv.dash.updatedAt", { time: updated.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) })}</button>
      </div>
      <div className="flex gap-3">
        <div className="w-[190px] shrink-0 space-y-3">
          <div className="rounded-lg bg-background p-2"><p className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground">{t("kv.dash.manage")}</p>
            {nav("stats")}{nav("cashflow")}</div>
          <DeliveryDashboardFilters value={filters} onChange={setFilters} />
        </div>
        <div className="min-w-0 flex-1">
          {view === "stats" ? <DeliveryDashboardStats data={dash.data} detailHref={detailHref} /> : <DeliveryCashflow data={cash.data} />}
        </div>
      </div>
    </div>
  );
}
