"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import { downloadCsv, GROUPS, PROFIT_RATE, type PeriodTax } from "./tax-calc";
import type { TaxProfile, TaxSettings } from "./tax-queries";

/** Tổng hợp nghĩa vụ thuế theo kỳ (số liệu cho tờ khai thuế hộ kinh doanh) — ƯỚC TÍNH, kế toán đối chiếu trước khi nộp. */
export function TaxDeclarationTab({ rows, tax, profile, year }: { rows: PeriodTax[]; tax: TaxSettings; profile: TaxProfile; year: number }) {
  const sum = (k: keyof PeriodTax) => rows.reduce((s, r) => s + Number(r[k]), 0);
  const profit = profile.pitMethod === "PROFIT";
  const cols: [string, (r: PeriodTax) => number][] = [
    ["Doanh thu", (r) => r.revenue], ["DT chịu GTGT", (r) => r.vatRevenue], ["DT không chịu GTGT", (r) => r.exemptRevenue],
    ["Thuế GTGT", (r) => r.vat],
    ...(profit ? [["Giá vốn", (r: PeriodTax) => r.cogs], ["Chi phí khác", (r: PeriodTax) => r.expenses]] as [string, (r: PeriodTax) => number][] : []),
    [profit ? "Thu nhập tính thuế" : "DT tính TNCN (vượt 1 tỷ)", (r) => r.pitBase], ["Thuế TNCN", (r) => r.pit],
    ["Tổng phải nộp", (r) => r.vat + r.pit],
  ];
  const exportCsv = () => downloadCsv(`to-khai-thue-${profile.taxCode}-${year}.csv`, ["Kỳ", ...cols.map(([h]) => h)],
    [...rows.map((r) => [r.label, ...cols.map(([, f]) => f(r))]), ["Cộng", ...cols.map(([, f]) => rows.reduce((s, r) => s + f(r), 0))]]);

  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-md bg-muted/50 p-3">
        <span>MST: <b>{profile.taxCode}</b></span><span>{GROUPS[profile.revenueGroup]}</span>
        <span>TNCN: <b>{profit ? `theo thu nhập, ${PROFIT_RATE[profile.revenueGroup]}%` : `theo doanh thu, ${tax.pitRate}%`}</b></span>
        <span>GTGT: <b>{tax.vatEnabled ? `${tax.vatRate}% trên doanh thu chịu thuế` : "Không áp dụng"}</b></span>
        <Button variant="outline" size="sm" className="ml-auto" onClick={exportCsv}><Download className="size-4" /> Xuất file</Button>
      </div>
      {profile.revenueGroup === 1 && <p className="text-green-700">Nhóm 1 (doanh thu năm từ 1 tỷ trở xuống): không phải nộp thuế GTGT, TNCN — chỉ cần ghi Sổ doanh thu (S1a-HKD).</p>}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-primary/10 text-left"><tr><th className="px-2 py-2">Kỳ</th>{cols.map(([h]) => <th key={h} className="px-2 text-right">{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-b"><td className="px-2 py-2">{r.label}</td>
                {cols.map(([h, f]) => <td key={h} className="px-2 text-right">{formatMoney(f(r))}</td>)}</tr>
            ))}
            <tr className="font-semibold"><td className="px-2 py-2">Cộng năm {year}</td>
              {cols.map(([h, f]) => <td key={h} className="px-2 text-right">{formatMoney(rows.reduce((s, r) => s + f(r), 0))}</td>)}</tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Doanh thu = hóa đơn hoàn thành − hàng khách trả (đã trừ giảm giá). Doanh thu lũy kế năm: {formatMoney(sum("revenue"))}.
        Số liệu là ước tính theo quy định hiện hành về thuế hộ kinh doanh từ 2026; hãy để kế toán đối chiếu trước khi nộp tờ khai trên Cổng thuế.
      </p>
    </div>
  );
}
