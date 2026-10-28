"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { accountingNs } from "@/messages/accounting";
import { commonNs } from "@/messages/common";
import { groupLabel, periodLabel } from "./accounting-labels";
import { downloadCsv, PROFIT_RATE, type PeriodTax } from "./tax-calc";
import type { TaxProfile, TaxSettings } from "./tax-queries";

type ColKey = keyof typeof accountingNs.vi.declaration.cols;
/** Tên cột tiếng Việt cố định cho CSV kê khai (file nộp / đối chiếu với kế toán luôn tiếng Việt). */
const VI_COLS = accountingNs.vi.declaration.cols;

/** Tổng hợp nghĩa vụ thuế theo kỳ (số liệu cho tờ khai thuế hộ kinh doanh) — ƯỚC TÍNH, kế toán đối chiếu trước khi nộp. */
export function TaxDeclarationTab({ rows, tax, profile, year, periodIdx }: {
  rows: PeriodTax[]; tax: TaxSettings; profile: TaxProfile; year: number; periodIdx: number;
}) {
  const t = useT(accountingNs);
  const tc = useT(commonNs);
  const sum = (k: keyof PeriodTax) => rows.reduce((s, r) => s + Number(r[k]), 0);
  const profit = profile.pitMethod === "PROFIT";
  const cols: [ColKey, (r: PeriodTax) => number][] = [
    ["revenue", (r) => r.revenue], ["vatRevenue", (r) => r.vatRevenue], ["exemptRevenue", (r) => r.exemptRevenue],
    ["vat", (r) => r.vat],
    ...(profit ? [["cogs", (r: PeriodTax) => r.cogs], ["expenses", (r: PeriodTax) => r.expenses]] as [ColKey, (r: PeriodTax) => number][] : []),
    [profit ? "taxableIncome" : "pitBaseRevenue", (r) => r.pitBase], ["pit", (r) => r.pit],
    ["totalDue", (r) => r.vat + r.pit],
  ];
  const exportCsv = () => downloadCsv(`to-khai-thue-${profile.taxCode}-${year}.csv`, ["Kỳ", ...cols.map(([k]) => VI_COLS[k])],
    [...rows.map((r) => [r.label, ...cols.map(([, f]) => f(r))]), ["Cộng", ...cols.map(([, f]) => rows.reduce((s, r) => s + f(r), 0))]]);

  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-md bg-muted/50 p-3">
        <span>{t("declaration.taxCodeLabel")} <b>{profile.taxCode}</b></span><span>{groupLabel(t, profile.revenueGroup)}</span>
        <span>{t("declaration.pitLabel")} <b>{profit ? t("declaration.pitByProfit", { rate: PROFIT_RATE[profile.revenueGroup] }) : t("declaration.pitByRevenue")}</b></span>
        <span>{t("declaration.vatLabel")} <b>{tax.vatEnabled ? t("declaration.vatBySector") : t("declaration.vatNotApplied")}</b></span>
        <Button variant="outline" size="sm" className="ml-auto" onClick={exportCsv}><Download className="size-4" /> {tc("actions.export")}</Button>
      </div>
      {profile.revenueGroup === 1 && <p className="text-green-700">{t("declaration.group1Note")}</p>}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-primary/10 text-left"><tr><th className="px-2 py-2">{t("declaration.period")}</th>
            {cols.map(([k]) => <th key={k} className="px-2 text-right">{t(`declaration.cols.${k}`)}</th>)}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-b"><td className="px-2 py-2">{periodLabel(t, r)}</td>
                {cols.map(([k, f]) => <td key={k} className="px-2 text-right">{formatMoney(f(r))}</td>)}</tr>
            ))}
            <tr className="font-semibold"><td className="px-2 py-2">{t("declaration.yearTotal", { year })}</td>
              {cols.map(([k, f]) => <td key={k} className="px-2 text-right">{formatMoney(rows.reduce((s, r) => s + f(r), 0))}</td>)}</tr>
          </tbody>
        </table>
      </div>
      <SectorBreakdown period={rows[periodIdx]} profit={profit} />
      <p className="text-xs text-muted-foreground">{t("declaration.footnote", { total: formatMoney(sum("revenue")) })}</p>
    </div>
  );
}

/** Chi tiết theo ngành nghề của kỳ đang chọn (mỗi ngành tỷ lệ riêng). Tên ngành là dữ liệu cửa hàng khai — không dịch. */
function SectorBreakdown({ period, profit }: { period?: PeriodTax; profit: boolean }) {
  const t = useT(accountingNs);
  if (!period) return null;
  return (
    <div className="space-y-1">
      <p className="font-medium">{t("declaration.sector.title", { period: periodLabel(t, period) })}</p>
      <table className="w-full">
        <thead className="bg-muted/60 text-left"><tr><th className="px-2 py-2">{t("declaration.sector.name")}</th>
          <th className="px-2 text-right">{t("declaration.sector.rates")}</th>
          <th className="px-2 text-right">{t("declaration.cols.revenue")}</th><th className="px-2 text-right">{t("declaration.cols.vatRevenue")}</th>
          <th className="px-2 text-right">{t("declaration.cols.vat")}</th>
          {!profit && <><th className="px-2 text-right">{t("declaration.sector.pitBase")}</th><th className="px-2 text-right">{t("declaration.cols.pit")}</th></>}</tr></thead>
        <tbody>
          {!period.bySector.length && <tr><td colSpan={7} className="py-4 text-center text-muted-foreground">{t("books.noRevenue")}</td></tr>}
          {period.bySector.map((s) => (
            <tr key={s.sector.code} className="border-b"><td className="px-2 py-1.5">{s.sector.name}</td>
              <td className="px-2 text-right">{s.sector.vatRate}% / {s.sector.pitRate}%</td>
              <td className="px-2 text-right">{formatMoney(s.revenue)}</td><td className="px-2 text-right">{formatMoney(s.vatRevenue)}</td>
              <td className="px-2 text-right">{formatMoney(s.vat)}</td>
              {!profit && <><td className="px-2 text-right">{formatMoney(s.pitBase)}</td><td className="px-2 text-right">{formatMoney(s.pit)}</td></>}</tr>
          ))}
        </tbody>
      </table>
      {!profit && period.bySector.length > 1 && (
        <p className="text-xs text-muted-foreground">{t("declaration.sector.allocationNote")}</p>
      )}
    </div>
  );
}
