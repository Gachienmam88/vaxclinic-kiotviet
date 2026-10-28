"use client";

import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate, formatMoney } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { accountingNs } from "@/messages/accounting";
import { periodLabel } from "./accounting-labels";
import { downloadCsv, exemptOf, netOf, type DailyRevenue, type Period, type TaxConfig } from "./tax-calc";

/**
 * Sổ doanh thu bán hàng hóa, dịch vụ (S1a-HKD / S2a-HKD): mỗi ngày × ngành nghề 1 dòng, tách doanh thu chịu / không chịu GTGT.
 * Dòng "Cộng" cuối kỳ; in khổ A4 bằng chức năng in của trình duyệt. Nội dung sổ (tiêu đề, cột, diễn giải) và CSV giữ
 * tiếng Việt ở mọi ngôn ngữ (chứng từ kế toán); chỉ thanh công cụ + dòng trống được dịch.
 */
export function RevenueBookTab({ rows, period, cfg, formCode, storeName, taxCode }: {
  rows: DailyRevenue[]; period: Period; cfg: TaxConfig; formCode: string; storeName: string; taxCode: string;
}) {
  const t = useT(accountingNs);
  const tc = useT(commonNs);
  const sectorName = (code: string) => cfg.sectors.find((x) => x.code === code)?.name ?? code;
  const days = new Map<string, { date: string; sector: string; vat: number; exempt: number }>();
  rows.filter((r) => r.date >= period.from && r.date <= period.to).forEach((r) => {
    const sector = cfg.sectorOf(r.productId);
    const key = `${r.date}|${sector}`;
    const d = days.get(key) ?? { date: r.date, sector, vat: 0, exempt: 0 };
    if (exemptOf(r, cfg)) d.exempt += netOf(r); else d.vat += netOf(r);
    days.set(key, d);
  });
  const list = [...days.entries()].sort(([a], [b]) => a.localeCompare(b));
  const total = list.reduce((s, [, d]) => ({ vat: s.vat + d.vat, exempt: s.exempt + d.exempt }), { vat: 0, exempt: 0 });
  const exportCsv = () => downloadCsv(`so-doanh-thu-${formCode}-${period.from}.csv`,
    ["Ngày tháng", "Diễn giải", "Ngành nghề", "DT chịu thuế GTGT", "DT không chịu thuế GTGT", "Tổng doanh thu"],
    [...list.map(([, v]) => [formatDate(v.date), `Doanh thu bán hàng ngày ${formatDate(v.date)}`, sectorName(v.sector), v.vat, v.exempt, v.vat + v.exempt]),
      ["", "Cộng", "", total.vat, total.exempt, total.vat + total.exempt]]);

  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center gap-2 print:hidden">
        <span className="text-muted-foreground">{t("books.formPeriod", { code: formCode, period: periodLabel(t, period), from: formatDate(period.from), to: formatDate(period.to) })}</span>
        <Button variant="outline" size="sm" className="ml-auto" onClick={() => window.print()}><Printer className="size-4" /> {tc("actions.print")}</Button>
        <Button variant="outline" size="sm" onClick={exportCsv}><Download className="size-4" /> {tc("actions.export")}</Button>
      </div>
      <div className="text-center">
        <p className="text-left">HỘ, CÁ NHÂN KINH DOANH: <b>{storeName}</b> — MST: {taxCode}</p>
        <h3 className="mt-2 text-base font-bold">SỔ DOANH THU BÁN HÀNG HÓA, DỊCH VỤ</h3>
        <p className="italic">Kỳ: {period.label} — Mẫu số {formCode}</p>
      </div>
      <table className="w-full border">
        <thead className="bg-muted/60"><tr><th className="border px-2 py-1.5">Ngày tháng</th><th className="border px-2">Diễn giải</th>
          <th className="border px-2">Ngành nghề</th>
          <th className="border px-2 text-right">DT chịu thuế GTGT</th><th className="border px-2 text-right">DT không chịu thuế GTGT</th>
          <th className="border px-2 text-right">Tổng doanh thu</th></tr></thead>
        <tbody>
          {!list.length && <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">{t("books.noRevenue")}</td></tr>}
          {list.map(([key, v]) => (
            <tr key={key}><td className="border px-2 py-1">{formatDate(v.date)}</td><td className="border px-2">Doanh thu bán hàng ngày {formatDate(v.date)}</td>
              <td className="border px-2">{sectorName(v.sector)}</td>
              <td className="border px-2 text-right">{formatMoney(v.vat)}</td><td className="border px-2 text-right">{formatMoney(v.exempt)}</td>
              <td className="border px-2 text-right">{formatMoney(v.vat + v.exempt)}</td></tr>
          ))}
          <tr className="font-semibold"><td className="border px-2 py-1" /><td className="border px-2" colSpan={2}>Cộng</td>
            <td className="border px-2 text-right">{formatMoney(total.vat)}</td><td className="border px-2 text-right">{formatMoney(total.exempt)}</td>
            <td className="border px-2 text-right">{formatMoney(total.vat + total.exempt)}</td></tr>
        </tbody>
      </table>
    </div>
  );
}
