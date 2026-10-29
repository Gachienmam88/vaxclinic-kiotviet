"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Info } from "lucide-react";
import { formatMoney, formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { deliveryNs } from "@/messages/delivery";
import { DonutChart } from "./delivery-donut-chart";
import { SHIPMENT_COLOR, SHIPMENT_STATUS_KEY, type ShipmentDashboard, type ShipmentStatus } from "./delivery-types";

const CARD = "rounded-lg bg-background";
const HEAD = "flex h-12 items-center border-b px-4 text-[14px] font-semibold";
type Metric = "count" | "cod" | "fee";

/**
 * Quản lý giao hàng → Thống kê (KiotViet): Đơn hàng cần xử lý (giao thất bại = Chờ giao lại, chờ chuyển hoàn, quá thời gian giao),
 * Số liệu tổng hợp, Tỉ lệ theo trạng thái (vành khuyên), Thống kê đơn giao và thu chi (bấm dòng → Vận đơn đã lọc).
 * detailHref(statuses?) dựng link sang Vận đơn với cùng bộ lọc.
 */
export function DeliveryDashboardStats({ data, detailHref }: { data: ShipmentDashboard | undefined; detailHref: (statuses?: string[]) => string }) {
  const t = useT(deliveryNs);
  const [metric, setMetric] = useState<Metric>("count");
  const rows = (data?.byStatus ?? []).filter((r) => r.status !== "CANCELLED");
  const val = (r: { count: number; cod: number; fee: number }) => Number(metric === "count" ? r.count : metric === "cod" ? r.cod : r.fee);
  const fmt = (n: number) => (metric === "count" ? formatNumber(n) : formatMoney(n));
  const tip = (text: string) => <span title={text} className="inline-flex"><Info className="size-3.5" /></span>;
  const cards = [["failed", data?.waitRedeliver, "#e53935", "WAIT_REDELIVER", t("kv.dash.failedTip")],
    ["waitReturn", data?.waitReturn, "#f29d38", "WAIT_RETURN", null],
    ["overdue", data?.overdue, "#1a73e8", null, t("kv.dash.overdueTip")]] as const;

  return (
    <div className="space-y-3">
      <div className={CARD}>
        <div className={HEAD}>{t("kv.dash.needAction")}</div>
        <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-3">
          {cards.map(([k, n, color, status, hint]) => (
            <Link key={k} href={detailHref(status ? [status] : undefined)} title={hint ?? undefined}
              className="rounded-md border border-l-[3px] px-3 py-2.5 hover:shadow-sm" style={{ borderLeftColor: color }}>
              <p className="text-[17px] font-semibold" style={{ color }}>{formatNumber(n ?? 0)}</p>
              <p className="text-[13px]">{t(`kv.dash.${k}`)}</p>
            </Link>))}
        </div>
      </div>
      <div className={CARD}>
        <div className={HEAD}>{t("kv.dash.summary")}</div>
        <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-3">
          {([["count", formatNumber(data?.total ?? 0), null], ["totalCod", formatMoney(data?.totalCod ?? 0), t("kv.dash.totalCodTip")],
            ["totalFee", formatMoney(data?.totalFee ?? 0), t("kv.dash.totalFeeTip")]] as const).map(([k, v, hint]) => (
            <div key={k} className="rounded-md bg-[#f4f5f7] px-3 py-3">
              <p className="flex items-center gap-1 text-xs text-muted-foreground">{t(`kv.dash.${k}`)}{hint && tip(hint)}</p>
              <p className="mt-1 text-[17px] font-semibold">{v}</p>
            </div>))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_2fr]">
        <div className={CARD}>
          <div className={HEAD}>{t("kv.dash.ratio")}
            <select aria-label={t("kv.dash.ratio")} className="ml-auto h-8 rounded-md bg-[#eef0f3] px-2 text-[13px] font-normal" value={metric}
              onChange={(e) => setMetric(e.target.value as Metric)}>
              <option value="count">{t("kv.dash.byCount")}</option><option value="cod">{t("kv.dash.byCod")}</option>
              <option value="fee">{t("kv.dash.byFee")}</option></select></div>
          <div className="p-4">
            <DonutChart label={t(metric === "count" ? "kv.dash.byCount" : metric === "cod" ? "kv.dash.byCod" : "kv.dash.byFee")}
              total={rows.reduce((s, r) => s + val(r), 0)} format={fmt}
              parts={rows.map((r) => ({ key: r.status, value: val(r), color: SHIPMENT_COLOR[r.status], label: t(SHIPMENT_STATUS_KEY[r.status]) }))} />
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-xs">
              {rows.map((r) => <span key={r.status} className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm" style={{ background: SHIPMENT_COLOR[r.status] }} />{t(SHIPMENT_STATUS_KEY[r.status])}</span>)}
            </div>
          </div>
        </div>
        <div className={CARD}>
          <div className={HEAD}>{t("kv.dash.table")}
            <Link href={detailHref()} className="ml-auto text-[13px] font-normal text-[#2171bc] hover:text-[#1a9dcc]">{t("kv.dash.detail")}</Link></div>
          <table className="w-full text-[13px]">
            <thead className="bg-[#e8f1fd] text-xs font-semibold [&_th]:h-9 [&_th]:px-3"><tr>
              <th className="w-8" /><th className="text-left">{t("kv.dash.colStatus")}</th><th className="text-right">{t("kv.dash.colCount")}</th>
              <th className="text-right">{t("kv.dash.colCod")}</th><th className="text-right">{t("kv.dash.colFee")}</th><th className="w-6" /></tr></thead>
            <tbody>
              <tr className="border-b font-bold [&_td]:h-9 [&_td]:px-3"><td /><td />
                <td className="text-right">{formatNumber(data?.total ?? 0)}</td><td className="text-right">{formatMoney(data?.totalCod ?? 0)}</td>
                <td className="text-right">{formatMoney(data?.totalFee ?? 0)}</td><td /></tr>
              {rows.map((r) => (
                <tr key={r.status} className={cn("group border-b [&_td]:h-9 [&_td]:px-3 hover:bg-muted/50")}>
                  <td><span className="block size-3 rounded-sm" style={{ background: SHIPMENT_COLOR[r.status as ShipmentStatus] }} /></td>
                  <td><Link href={detailHref([r.status])} className="hover:text-primary">{t(SHIPMENT_STATUS_KEY[r.status])}</Link></td>
                  <td className="text-right text-[#2171bc]">{formatNumber(r.count)}</td><td className="text-right">{formatMoney(r.cod)}</td>
                  <td className="text-right">{formatMoney(r.fee)}</td>
                  <td><ChevronRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100" /></td>
                </tr>))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
