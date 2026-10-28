"use client";

import { useState } from "react";
import { downloadCsv } from "@/features/accounting/tax-calc";
import { useUserLookup } from "@/features/purchases/purchase-queries";
import { ymd } from "@/features/dashboard/dashboard-date-utils";
import { useT } from "@/lib/i18n";
import { reportsNs } from "@/messages/reports";
import { eodCashColumns, eodCashLines, eodProductColumns, eodSummaryColumns, eodSummaryLines, productLines } from "./end-of-day-other-lines";
import { eodHorizontalColumns, eodSalesLines, eodVerticalColumns } from "./end-of-day-sales-lines";
import { PAYMENT_METHODS, SALE_MODES, useReport, type DocRow, type ProductRow, type VoucherRow } from "./report-api";
import { BranchFilter, CustomerFilter, ReportLayout, SelectFilter, useBranchLabel, ViewModeFilter, type PickedCustomer } from "./report-sidebar-kit";
import { asTable, linesToCsv, ReportTable } from "./report-table";
import { DayFilter, dayRange, type DayValue } from "./report-time-filter";
import { ReportViewer } from "./report-viewer";

type Concern = "sales" | "cashflow" | "products" | "summary";
/** Mối quan tâm; nhãn "eod.concerns.<…>", tiêu đề tờ báo cáo "eod.titles.<…>". */
const CONCERNS: Concern[] = ["sales", "cashflow", "products", "summary"];
/** Phương thức thanh toán → quỹ của phiếu thu/chi. */
const FUND_OF: Record<string, string> = { CASH: "CASH", TRANSFER: "BANK", CARD: "BANK", EWALLET: "EWALLET" };

/** Báo cáo cuối ngày (chỉ kiểu Báo cáo): Bán hàng / Thu chi / Hàng hóa / Tổng hợp, hiển thị dọc hoặc ngang. */
export function EndOfDayReport() {
  const t = useT(reportsNs);
  const [horizontal, setHorizontal] = useState(false);
  const [concern, setConcern] = useState<Concern>("sales");
  const [time, setTime] = useState<DayValue>({ mode: "day", day: ymd(new Date()), fromTime: "", toTime: "" });
  const [customer, setCustomer] = useState<PickedCustomer>(null);
  const [seller, setSeller] = useState("");
  const [creator, setCreator] = useState("");
  const [method, setMethod] = useState("");
  const [saleMode, setSaleMode] = useState("");
  const [branch, setBranch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const { data: users = [] } = useUserLookup();
  const branchLabel = useBranchLabel(branch);
  const span = dayRange(time);
  const base = { branchIds: branch || undefined, customerId: customer?.id, createdBy: creator || undefined };
  const salesQ = useReport<DocRow[]>("/reports/end-of-day/sales", span,
    { ...base, sellerId: seller || undefined, methods: method || undefined, saleModes: saleMode || undefined }, concern === "sales" || concern === "summary");
  const cashQ = useReport<VoucherRow[]>("/reports/end-of-day/cashflow", span,
    { ...base, sellerId: seller || undefined, funds: method ? FUND_OF[method] : undefined }, concern === "cashflow" || concern === "summary");
  const prodQ = useReport<ProductRow[]>("/reports/sales/products", span,
    { ...base, sellerId: seller || undefined, methods: method || undefined, saleModes: saleMode || undefined }, concern === "products" || concern === "summary");
  const toggle = (id: string) => setExpanded((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  // Bảng theo mối quan tâm
  const { columns, lines } = concern === "sales" ? asTable(horizontal ? eodHorizontalColumns(t) : eodVerticalColumns(t), eodSalesLines(t, salesQ.data ?? [], horizontal))
    : concern === "cashflow" ? asTable(eodCashColumns(t), eodCashLines(t, cashQ.data ?? [], horizontal))
      : concern === "products" ? asTable(eodProductColumns(t), productLines(t, prodQ.data ?? []))
        : asTable(eodSummaryColumns(t), eodSummaryLines(t, salesQ.data ?? [], cashQ.data ?? [], prodQ.data ?? []));
  const active = concern === "cashflow" ? cashQ : concern === "products" ? prodQ : salesQ;
  const exportCsv = () => { const csv = linesToCsv(columns, lines); downloadCsv(`bao-cao-cuoi-ngay-${concern}-${ymd(span.from)}.csv`, csv.header, csv.rows); };

  return (
    <ReportLayout title={t("eod.title")} sidebar={<>
      <ViewModeFilter value="report" onChange={() => undefined} reportOnly />
      <SelectFilter value={horizontal ? "h" : "v"} onChange={(v) => setHorizontal(v === "h")} options={[["v", t("eod.vertical")], ["h", t("eod.horizontal")]]} />
      <SelectFilter title={t("filters.concern")} value={concern} onChange={(v) => { setConcern(v as Concern); setExpanded(new Set()); }}
        options={CONCERNS.map((c) => [c, t(`eod.concerns.${c}`)] as const)} />
      <BranchFilter value={branch} onChange={setBranch} />
      <DayFilter value={time} onChange={setTime} />
      <CustomerFilter value={customer} onChange={setCustomer} />
      <SelectFilter title={t("filters.employee")} value={seller} onChange={setSeller} placeholder={t("filters.pickEmployee")} options={users.map((u) => [u.id, u.fullName] as const)} />
      <SelectFilter title={t("filters.creator")} value={creator} onChange={setCreator} placeholder={t("filters.pickCreator")} options={users.map((u) => [u.id, u.fullName] as const)} />
      <SelectFilter title={t("filters.paymentMethod")} value={method} onChange={setMethod} placeholder={t("filters.pickPaymentMethod")}
        options={PAYMENT_METHODS.map((m) => [m, t(`paymentMethods.${m}`)] as const)} />
      <SelectFilter title={t("filters.saleMode")} value={saleMode} onChange={setSaleMode} placeholder={t("filters.pickSaleMode")}
        options={SALE_MODES.map((m) => [m, t(`saleModes.${m}`)] as const)}
        disabled={concern === "cashflow"} hint={concern === "cashflow" ? t("eod.saleModeHint") : undefined} />
    </>}>
      <ReportViewer title={t(`eod.titles.${concern}`)} landscape={horizontal && concern !== "summary"} loading={active.isFetching}
        onRefresh={() => (concern === "summary" ? [salesQ, cashQ, prodQ] : [active]).forEach((q) => q.refetch())} onExport={lines.length ? exportCsv : undefined}
        meta={[t("eod.saleDateMeta", { range: span.label }), t("eod.payDateMeta", { range: span.label }), t("common.branchMeta", { branch: branchLabel })]}>
        {active.isError ? <p className="rp-empty">{t("common.loadError")}</p>
          : <ReportTable columns={columns} lines={lines} expanded={expanded} onToggle={toggle} />}
      </ReportViewer>
    </ReportLayout>
  );
}
