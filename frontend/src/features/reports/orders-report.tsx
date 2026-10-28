"use client";

import { useState } from "react";
import { downloadCsv } from "@/features/accounting/tax-calc";
import { ymd } from "@/features/dashboard/dashboard-date-utils";
import { ORDER_STATUS_KEY, ORDER_STATUS_OPTIONS, type OrderStatus } from "@/features/orders/order-types";
import { useT } from "@/lib/i18n";
import { ordersNs } from "@/messages/orders";
import { reportsNs, type ReportsT } from "@/messages/reports";
import { BarChart, ChartCard, EmptyChart } from "./report-charts";
import { DELIVERY_PRESETS, deliverySpan } from "./report-filter-options";
import { spanOf, sumOf, useReport, type OrderProductRow, type OrderRow } from "./report-api";
import { BranchFilter, CheckFilter, CustomerFilter, ReportLayout, SelectFilter, TextFilter, useBranchLabel, ViewModeFilter, type PickedCustomer, type ViewMode } from "./report-sidebar-kit";
import { asTable, linesToCsv, ReportTable, type ReportColumn, type ReportLine } from "./report-table";
import { TimeFilter } from "./report-time-filter";
import { rangeText, timeRange, type TimeValue } from "./report-time-presets";
import { ReportViewer } from "./report-viewer";
import { top10 } from "./summary-table-kit";
import { DocCodeLink } from "@/components/ui/doc-code-link";

type Concern = "products" | "transactions";
type OAgg = { code: string; name: string; customer: string; time: string; status: string; qty: number; value: number; invoiced: number;
  subtotal: number; discount: number; total: number; deposit: number; invoice: string };
const blank: OAgg = { code: "", name: "", customer: "", time: "", status: "", qty: 0, value: 0, invoiced: 0, subtotal: 0, discount: 0, total: 0, deposit: 0, invoice: "" };
const fromProduct = (p: OrderProductRow): OAgg => ({ ...blank, code: p.code, name: p.unit ? `${p.name} (${p.unit})` : p.name, qty: +p.qty, value: +p.value, invoiced: +p.invoicedQty });
type StatusT = (key: (typeof ORDER_STATUS_KEY)[OrderStatus]) => string;
const statusLabel = (to: StatusT, s: string) => (s in ORDER_STATUS_KEY ? to(ORDER_STATUS_KEY[s as OrderStatus]) : s);
const fromOrder = (to: StatusT, o: OrderRow): OAgg => ({ ...blank, code: o.code, customer: o.customerName, time: new Date(o.orderedAt).toLocaleString("vi-VN"),
  status: statusLabel(to, o.status), qty: +o.qty, subtotal: +o.subtotal, discount: +o.discount, total: +o.total, deposit: +o.deposit, invoice: o.invoiceCode ?? "" });
const m = (key: keyof OAgg, label: string, type: "money" | "qty" = "money"): ReportColumn<OAgg> => ({ key, label, type, value: (r) => r[key] });
const CODE = (label: string): ReportColumn<OAgg> => ({ key: "code", label, value: (r) => r.code, render: (r) => <b><DocCodeLink code={r.code} /></b> });
const productCols = (t: ReportsT) => [CODE(t("cols.productCode")), { key: "name", label: t("cols.productName"), value: (r: OAgg) => r.name },
  m("qty", t("cols.qtyOrdered"), "qty"), m("value", t("cols.orderValue")), m("invoiced", t("cols.qtyInvoiced"), "qty")];
const orderCols = (t: ReportsT) => [CODE(t("cols.orderCode")), { key: "time", label: t("cols.time"), value: (r: OAgg) => r.time },
  { key: "customer", label: t("cols.customer"), value: (r: OAgg) => r.customer }, m("qty", t("cols.qty"), "qty"), m("subtotal", t("cols.subtotal")),
  m("discount", t("cols.discount")), m("total", t("cols.toPay")), m("deposit", t("cols.deposit")),
  { key: "status", label: t("cols.status"), value: (r: OAgg) => r.status },
  { key: "invoice", label: t("cols.invoice"), value: (r: OAgg) => r.invoice, render: (r: OAgg) => <DocCodeLink code={r.invoice} /> }];

function lines(rows: OAgg[], label: string): ReportLine<OAgg>[] {
  if (!rows.length) return [];
  const s = (k: keyof OAgg) => sumOf(rows, (r) => r[k] as number);
  return [{ id: "sum", kind: "sum", label, data: { ...blank, qty: s("qty"), value: s("value"), invoiced: s("invoiced"), subtotal: s("subtotal"),
    discount: s("discount"), total: s("total"), deposit: s("deposit") } }, ...rows.map((r, i) => ({ id: `${r.code}-${i}`, kind: "row" as const, data: r }))];
}

/** Báo cáo đặt hàng: Top 10 hàng được đặt nhiều nhất / báo cáo theo Hàng hóa hoặc Giao dịch. */
export function OrdersReport() {
  const t = useT(reportsNs);
  const to = useT(ordersNs);
  const [mode, setMode] = useState<ViewMode>("chart");
  const [concern, setConcern] = useState<Concern>("products");
  const [merge, setMerge] = useState(false);
  const [time, setTime] = useState<TimeValue>({ mode: "preset", preset: "thisWeek" });
  const [status, setStatus] = useState("");
  const [customer, setCustomer] = useState<PickedCustomer>(null);
  const [q, setQ] = useState("");
  const [branch, setBranch] = useState("");
  const [delivery, setDelivery] = useState("");
  const branchLabel = useBranchLabel(branch);
  const range = timeRange(time), span = spanOf(range);
  const params = { branchIds: branch || undefined, statuses: status || undefined, customerId: customer?.id, q, ...deliverySpan(delivery) };
  const prodQ = useReport<OrderProductRow[]>("/reports/orders/products", span, { ...params, merge }, concern === "products" || mode === "chart");
  const ordQ = useReport<OrderRow[]>("/reports/orders/transactions", span, params, concern === "transactions" && mode === "report");
  const products = (prodQ.data ?? []).map(fromProduct), orders = (ordQ.data ?? []).map((o) => fromOrder(to, o));
  const table = concern === "products" ? asTable(productCols(t), lines(products, t("common.itemCount", { n: products.length })))
    : asTable(orderCols(t), lines(orders, t("orders.orderCount", { n: orders.length })));
  const active = concern === "products" ? prodQ : ordQ;
  const exportCsv = () => { const csv = linesToCsv(table.columns, table.lines); downloadCsv(`bao-cao-dat-hang-${concern}-${ymd(range.from)}.csv`, csv.header, csv.rows); };
  const items = top10(products.map((p) => ({ label: p.name, value: p.qty })));

  return (
    <ReportLayout title={t("orders.title")} sidebar={<>
      <ViewModeFilter value={mode} onChange={setMode} />
      <CheckFilter checked={merge} onChange={setMerge}>{t("filters.mergeSameProducts")}</CheckFilter>
      <SelectFilter title={t("filters.concern")} value={concern} onChange={(v) => setConcern(v as Concern)}
        options={[["products", t("orders.concerns.products")], ["transactions", t("orders.concerns.transactions")]]} />
      <BranchFilter value={branch} onChange={setBranch} />
      <TimeFilter title={t("orders.orderTime")} value={time} onChange={setTime} />
      <SelectFilter title={t("orders.deliveryTime")} value={delivery} onChange={setDelivery} placeholder={t("orders.allTime")}
        options={DELIVERY_PRESETS.map((p) => [p, t(`deliveryPresets.${p}`)] as const)} />
      <SelectFilter title={t("filters.status")} value={status} onChange={setStatus} placeholder={t("filters.pickStatus")}
        options={ORDER_STATUS_OPTIONS.map(([v]) => [v, to(ORDER_STATUS_KEY[v])] as const)} />
      <CustomerFilter value={customer} onChange={setCustomer} />
      <TextFilter title={t("filters.product")} value={q} onChange={setQ} placeholder={t("filters.productPlaceholder")} />
    </>}>
      {mode === "chart" ? <ChartCard title={t("orders.chartTitle")}>{items.length ? <BarChart items={items} money={false} /> : <EmptyChart />}</ChartCard> : (
        <ReportViewer title={concern === "products" ? t("orders.titleProducts") : t("orders.titleTransactions")}
          meta={[rangeText(t, range), t("common.branchMeta", { branch: branchLabel })]} landscape={concern === "transactions"} loading={active.isFetching}
          note={concern === "products" ? t("orders.noteProducts") : undefined}
          onRefresh={() => active.refetch()} onExport={table.lines.length ? exportCsv : undefined}>
          {active.isError ? <p className="rp-empty">{t("common.loadError")}</p> : <ReportTable columns={table.columns} lines={table.lines} />}
        </ReportViewer>)}
    </ReportLayout>
  );
}
