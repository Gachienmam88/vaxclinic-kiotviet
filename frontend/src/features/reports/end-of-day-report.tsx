"use client";

import { useState } from "react";
import { downloadCsv } from "@/features/accounting/tax-calc";
import { useUserLookup } from "@/features/purchases/purchase-queries";
import { ymd } from "@/features/dashboard/dashboard-date-utils";
import { eodCashLines, EOD_CASH_COLUMNS, eodSummaryLines, PRODUCT_COLUMNS, productLines, SUMMARY_COLUMNS } from "./end-of-day-other-lines";
import { EOD_HORIZONTAL, EOD_VERTICAL, eodSalesLines } from "./end-of-day-sales-lines";
import { PAYMENT_METHODS, SALE_MODES, useReport, type DocRow, type ProductRow, type VoucherRow } from "./report-api";
import { BranchFilter, CustomerFilter, ReportLayout, SelectFilter, useBranchLabel, ViewModeFilter, type PickedCustomer } from "./report-sidebar-kit";
import { asTable, linesToCsv, ReportTable } from "./report-table";
import { DayFilter, dayRange, type DayValue } from "./report-time-filter";
import { ReportViewer } from "./report-viewer";

type Concern = "sales" | "cashflow" | "products" | "summary";
const CONCERNS: [Concern, string][] = [["sales", "Bán hàng"], ["cashflow", "Thu chi"], ["products", "Hàng hóa"], ["summary", "Tổng hợp"]];
const TITLES: Record<Concern, string> = {
  sales: "Báo cáo cuối ngày về bán hàng", cashflow: "Báo cáo cuối ngày về thu chi", products: "Báo cáo cuối ngày về hàng hóa", summary: "Báo cáo cuối ngày tổng hợp",
};
/** Phương thức thanh toán → quỹ của phiếu thu/chi. */
const FUND_OF: Record<string, string> = { CASH: "CASH", TRANSFER: "BANK", CARD: "BANK", EWALLET: "EWALLET" };

/** Báo cáo cuối ngày (chỉ kiểu Báo cáo): Bán hàng / Thu chi / Hàng hóa / Tổng hợp, hiển thị dọc hoặc ngang. */
export function EndOfDayReport() {
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
  const { columns, lines } = concern === "sales" ? asTable(horizontal ? EOD_HORIZONTAL : EOD_VERTICAL, eodSalesLines(salesQ.data ?? [], horizontal))
    : concern === "cashflow" ? asTable(EOD_CASH_COLUMNS, eodCashLines(cashQ.data ?? [], horizontal))
      : concern === "products" ? asTable(PRODUCT_COLUMNS, productLines(prodQ.data ?? []))
        : asTable(SUMMARY_COLUMNS, eodSummaryLines(salesQ.data ?? [], cashQ.data ?? [], prodQ.data ?? []));
  const active = concern === "cashflow" ? cashQ : concern === "products" ? prodQ : salesQ;
  const exportCsv = () => { const t = linesToCsv(columns, lines); downloadCsv(`bao-cao-cuoi-ngay-${concern}-${ymd(span.from)}.csv`, t.header, t.rows); };

  return (
    <ReportLayout title="Báo cáo cuối ngày" sidebar={<>
      <ViewModeFilter value="report" onChange={() => undefined} reportOnly />
      <SelectFilter value={horizontal ? "h" : "v"} onChange={(v) => setHorizontal(v === "h")} options={[["v", "Hiển thị dọc"], ["h", "Hiển thị ngang"]]} />
      <SelectFilter title="Mối quan tâm" value={concern} onChange={(v) => { setConcern(v as Concern); setExpanded(new Set()); }} options={CONCERNS} />
      <BranchFilter value={branch} onChange={setBranch} />
      <DayFilter value={time} onChange={setTime} />
      <CustomerFilter value={customer} onChange={setCustomer} />
      <SelectFilter title="Nhân viên" value={seller} onChange={setSeller} placeholder="Chọn nhân viên" options={users.map((u) => [u.id, u.fullName] as const)} />
      <SelectFilter title="Người tạo" value={creator} onChange={setCreator} placeholder="Chọn người tạo" options={users.map((u) => [u.id, u.fullName] as const)} />
      <SelectFilter title="Phương thức thanh toán" value={method} onChange={setMethod} placeholder="Chọn phương thức thanh toán" options={PAYMENT_METHODS} />
      <SelectFilter title="Phương thức bán hàng" value={saleMode} onChange={setSaleMode} placeholder="Chọn phương thức bán hàng" options={SALE_MODES}
        disabled={concern === "cashflow"} hint={concern === "cashflow" ? "Phiếu thu chi không gắn phương thức bán hàng" : undefined} />
    </>}>
      <ReportViewer title={TITLES[concern]} landscape={horizontal && concern !== "summary"} loading={active.isFetching}
        onRefresh={() => (concern === "summary" ? [salesQ, cashQ, prodQ] : [active]).forEach((q) => q.refetch())} onExport={lines.length ? exportCsv : undefined}
        meta={[`Ngày bán: ${span.label}`, `Ngày thanh toán: ${span.label}`, `Chi nhánh: ${branchLabel}`]}>
        {active.isError ? <p className="rp-empty">Không tải được báo cáo</p>
          : <ReportTable columns={columns} lines={lines} expanded={expanded} onToggle={toggle} />}
      </ReportViewer>
    </ReportLayout>
  );
}
