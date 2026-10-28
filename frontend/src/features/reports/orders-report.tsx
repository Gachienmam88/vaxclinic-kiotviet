"use client";

import { useState } from "react";
import { downloadCsv } from "@/features/accounting/tax-calc";
import { ymd } from "@/features/dashboard/dashboard-date-utils";
import { ORDER_STATUS_OPTIONS, orderStatusLabel } from "@/features/orders/order-types";
import { BarChart, ChartCard, EmptyChart } from "./report-charts";
import { spanOf, sumOf, useReport, type OrderProductRow, type OrderRow } from "./report-api";
import { BranchFilter, CheckFilter, CustomerFilter, ReportLayout, SelectFilter, TextFilter, useBranchLabel, ViewModeFilter, type PickedCustomer, type ViewMode } from "./report-sidebar-kit";
import { asTable, linesToCsv, ReportTable, type ReportColumn, type ReportLine } from "./report-table";
import { TimeFilter } from "./report-time-filter";
import { rangeText, timeRange, type TimeValue } from "./report-time-presets";
import { ReportViewer } from "./report-viewer";
import { top10 } from "./summary-table-kit";

type Concern = "products" | "transactions";
type OAgg = { code: string; name: string; customer: string; time: string; status: string; qty: number; value: number; invoiced: number;
  subtotal: number; discount: number; total: number; deposit: number; invoice: string };
const blank: OAgg = { code: "", name: "", customer: "", time: "", status: "", qty: 0, value: 0, invoiced: 0, subtotal: 0, discount: 0, total: 0, deposit: 0, invoice: "" };
const fromProduct = (p: OrderProductRow): OAgg => ({ ...blank, code: p.code, name: p.unit ? `${p.name} (${p.unit})` : p.name, qty: +p.qty, value: +p.value, invoiced: +p.invoicedQty });
const fromOrder = (o: OrderRow): OAgg => ({ ...blank, code: o.code, customer: o.customerName, time: new Date(o.orderedAt).toLocaleString("vi-VN"),
  status: orderStatusLabel(o.status as never), qty: +o.qty, subtotal: +o.subtotal, discount: +o.discount, total: +o.total, deposit: +o.deposit, invoice: o.invoiceCode ?? "" });
const m = (key: keyof OAgg, label: string, type: "money" | "qty" = "money"): ReportColumn<OAgg> => ({ key, label, type, value: (r) => r[key] });
const CODE = (label: string): ReportColumn<OAgg> => ({ key: "code", label, value: (r) => r.code, render: (r) => <b className="rp-link">{r.code}</b> });
const PRODUCT_COLS = [CODE("Mã hàng"), { key: "name", label: "Tên hàng", value: (r: OAgg) => r.name }, m("qty", "SL đặt", "qty"), m("value", "Giá trị đặt"),
  m("invoiced", "SL đã tạo hóa đơn", "qty")];
const ORDER_COLS = [CODE("Mã đặt hàng"), { key: "time", label: "Thời gian", value: (r: OAgg) => r.time }, { key: "customer", label: "Khách hàng", value: (r: OAgg) => r.customer },
  m("qty", "SL", "qty"), m("subtotal", "Tổng tiền hàng"), m("discount", "Giảm giá"), m("total", "Khách cần trả"), m("deposit", "Khách đã trả"),
  { key: "status", label: "Trạng thái", value: (r: OAgg) => r.status }, { key: "invoice", label: "Hóa đơn", value: (r: OAgg) => r.invoice }];

function lines(rows: OAgg[], label: string): ReportLine<OAgg>[] {
  if (!rows.length) return [];
  const s = (k: keyof OAgg) => sumOf(rows, (r) => r[k] as number);
  return [{ id: "sum", kind: "sum", label, data: { ...blank, qty: s("qty"), value: s("value"), invoiced: s("invoiced"), subtotal: s("subtotal"),
    discount: s("discount"), total: s("total"), deposit: s("deposit") } }, ...rows.map((r, i) => ({ id: `${r.code}-${i}`, kind: "row" as const, data: r }))];
}

/** Báo cáo đặt hàng: Top 10 hàng được đặt nhiều nhất / báo cáo theo Hàng hóa hoặc Giao dịch. */
export function OrdersReport() {
  const [mode, setMode] = useState<ViewMode>("chart");
  const [concern, setConcern] = useState<Concern>("products");
  const [merge, setMerge] = useState(false);
  const [time, setTime] = useState<TimeValue>({ mode: "preset", preset: "thisWeek" });
  const [status, setStatus] = useState("");
  const [customer, setCustomer] = useState<PickedCustomer>(null);
  const [q, setQ] = useState("");
  const [branch, setBranch] = useState("");
  const branchLabel = useBranchLabel(branch);
  const range = timeRange(time), span = spanOf(range);
  const params = { branchIds: branch || undefined, statuses: status || undefined, customerId: customer?.id, q };
  const prodQ = useReport<OrderProductRow[]>("/reports/orders/products", span, { ...params, merge }, concern === "products" || mode === "chart");
  const ordQ = useReport<OrderRow[]>("/reports/orders/transactions", span, params, concern === "transactions" && mode === "report");
  const products = (prodQ.data ?? []).map(fromProduct), orders = (ordQ.data ?? []).map(fromOrder);
  const table = concern === "products" ? asTable(PRODUCT_COLS, lines(products, `SL mặt hàng: ${products.length}`))
    : asTable(ORDER_COLS, lines(orders, `SL đơn đặt hàng: ${orders.length}`));
  const active = concern === "products" ? prodQ : ordQ;
  const exportCsv = () => { const t = linesToCsv(table.columns, table.lines); downloadCsv(`bao-cao-dat-hang-${concern}-${ymd(range.from)}.csv`, t.header, t.rows); };
  const items = top10(products.map((p) => ({ label: p.name, value: p.qty })));

  return (
    <ReportLayout title="Báo cáo đặt hàng" sidebar={<>
      <ViewModeFilter value={mode} onChange={setMode} />
      <CheckFilter checked={merge} onChange={setMerge}>Gộp hàng hóa cùng loại</CheckFilter>
      <SelectFilter title="Mối quan tâm" value={concern} onChange={(v) => setConcern(v as Concern)} options={[["products", "Hàng hóa"], ["transactions", "Giao dịch"]]} />
      <BranchFilter value={branch} onChange={setBranch} />
      <TimeFilter title="Thời gian đặt hàng" value={time} onChange={setTime} />
      <SelectFilter title="Thời gian giao hàng" value="" onChange={() => undefined} options={[["", "Toàn thời gian"]]}
        hint="Đơn đặt hàng chưa có ngày giao hàng riêng nên lấy toàn thời gian" />
      <SelectFilter title="Trạng thái" value={status} onChange={setStatus} placeholder="Chọn trạng thái" options={ORDER_STATUS_OPTIONS} />
      <CustomerFilter value={customer} onChange={setCustomer} />
      <TextFilter title="Hàng hóa" value={q} onChange={setQ} placeholder="Theo mã, tên hàng" />
    </>}>
      {mode === "chart" ? <ChartCard title="Top 10 hàng hóa được đặt nhiều nhất">{items.length ? <BarChart items={items} money={false} /> : <EmptyChart />}</ChartCard> : (
        <ReportViewer title={concern === "products" ? "Báo cáo đặt hàng theo hàng hóa" : "Báo cáo đặt hàng theo giao dịch"}
          meta={[rangeText(range), `Chi nhánh: ${branchLabel}`]} landscape={concern === "transactions"} loading={active.isFetching}
          note={concern === "products" ? "(Giá trị đặt đã phân bổ giảm giá đơn)" : undefined}
          onRefresh={() => active.refetch()} onExport={table.lines.length ? exportCsv : undefined}>
          {active.isError ? <p className="rp-empty">Không tải được báo cáo</p> : <ReportTable columns={table.columns} lines={table.lines} />}
        </ReportViewer>)}
    </ReportLayout>
  );
}
