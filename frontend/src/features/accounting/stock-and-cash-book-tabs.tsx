"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/features/products/product-form-sections";
import { api } from "@/lib/api-client";
import { formatDate, formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { downloadCsv, type Period } from "./tax-calc";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { accountingNs } from "@/messages/accounting";
import { periodLabel } from "./accounting-labels";
import { DocCodeLink } from "@/components/ui/doc-code-link";

type StockLine = { productId: string; productCode: string; productName: string; unitName: string; openingQty: number; openingValue: number;
  inQty: number; inValue: number; outQty: number; outValue: number; closingQty: number; closingValue: number };

const branchQuery = (ids: string[]) => ids.map((b) => `&branchIds=${b}`).join("");

/**
 * Sổ chi tiết vật liệu, dụng cụ, sản phẩm, hàng hóa (S2d-HKD): đầu kỳ – nhập – xuất – cuối kỳ.
 * Cột / dòng của sổ và CSV giữ tiếng Việt (sổ kế toán theo mẫu); thanh công cụ được dịch. Sổ tiền S2e-HKD cũng vậy.
 */
export function StockBookTab({ period, branchIds }: { period: Period; branchIds: string[] }) {
  const t = useT(accountingNs);
  const tc = useT(commonNs);
  const { data = [], isLoading } = useQuery({
    queryKey: ["stock-book", period.from, period.to, branchIds.join()],
    queryFn: () => api<StockLine[]>(`/accounting/stock/summary?from=${period.from}&to=${period.to}${branchQuery(branchIds)}`),
  });
  const cols: [string, (l: StockLine) => number, boolean][] = [["SL đầu kỳ", (l) => l.openingQty, false], ["GT đầu kỳ", (l) => l.openingValue, true],
    ["SL nhập", (l) => l.inQty, false], ["GT nhập", (l) => l.inValue, true], ["SL xuất", (l) => l.outQty, false], ["GT xuất", (l) => l.outValue, true],
    ["SL cuối kỳ", (l) => l.closingQty, false], ["GT cuối kỳ", (l) => l.closingValue, true]];
  const exportCsv = () => downloadCsv(`so-hang-hoa-S2d-${period.from}.csv`, ["Mã hàng", "Tên hàng", "ĐVT", ...cols.map(([h]) => h)],
    data.map((l) => [l.productCode, l.productName, l.unitName, ...cols.map(([, f]) => Number(f(l)))]));
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center"><span className="text-muted-foreground">{t("books.stockNote", { code: "S2d-HKD", period: periodLabel(t, period) })}</span>
        <Button variant="outline" size="sm" className="ml-auto" onClick={exportCsv}><Download className="size-4" /> {tc("actions.export")}</Button></div>
      <div className="overflow-x-auto">
        <table className="w-full border">
          <thead className="bg-muted/60"><tr><th className="border px-2 py-1.5 text-left">Mã hàng</th><th className="border px-2 text-left">Tên hàng</th>
            <th className="border px-2">ĐVT</th>{cols.map(([h]) => <th key={h} className="border px-2 text-right">{h}</th>)}</tr></thead>
          <tbody>
            {isLoading && <tr><td colSpan={11} className="py-6 text-center text-muted-foreground">{tc("status.loading")}</td></tr>}
            {data.map((l) => (
              <tr key={l.productId}><td className="border px-2 py-1"><DocCodeLink code={l.productCode} className="print:text-inherit" /></td><td className="border px-2">{l.productName}</td>
                <td className="border px-2 text-center">{l.unitName}</td>
                {cols.map(([h, f, money]) => <td key={h} className="border px-2 text-right">{money ? formatMoney(f(l)) : formatNumber(f(l))}</td>)}</tr>
            ))}
            <tr className="font-semibold"><td className="border px-2 py-1" colSpan={3}>Cộng</td>
              {cols.map(([h, f, money]) => <td key={h} className="border px-2 text-right">{money ? formatMoney(data.reduce((s, l) => s + Number(f(l)), 0)) : ""}</td>)}</tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

type CashItem = { id: string; code: string; occurredAt: string; voucherType: string; category: string; partnerName: string | null; amount: number };
type CashPage = { items: CashItem[]; total: number; summary: { opening: number; receipts: number; payments: number; closing: number } };

/** Sổ chi tiết tiền (S2e-HKD): tiền mặt / tiền gửi ngân hàng — tồn đầu, thu, chi, tồn cuối (lấy từ Sổ quỹ). */
export function CashBookTab({ period, branchIds }: { period: Period; branchIds: string[] }) {
  const t = useT(accountingNs);
  const tc = useT(commonNs);
  const [fund, setFund] = useState("CASH");
  const from = new Date(`${period.from}T00:00:00+07:00`).toISOString();
  const to = new Date(new Date(`${period.to}T00:00:00+07:00`).getTime() + 86_400_000).toISOString();
  const branch = branchIds.length === 1 ? `&branchId=${branchIds[0]}` : "";
  const { data } = useQuery({
    queryKey: ["cash-book", fund, from, to, branch],
    queryFn: async () => { // gom tối đa 20 trang × 100 phiếu
      const first = await api<CashPage>(`/cashbook?fund=${fund}&from=${from}&to=${to}&statuses=PAID&size=100&page=0${branch}`);
      const items = [...first.items];
      for (let p = 1; p * 100 < first.total && p < 20; p++) {
        items.push(...(await api<CashPage>(`/cashbook?fund=${fund}&from=${from}&to=${to}&statuses=PAID&size=100&page=${p}${branch}`)).items);
      }
      return { ...first, items: items.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)) };
    },
  });
  let balance = Number(data?.summary.opening ?? 0);
  const lines = (data?.items ?? []).map((i) => {
    const inAmt = i.voucherType === "RECEIPT" ? Number(i.amount) : 0, outAmt = i.voucherType === "PAYMENT" ? Number(i.amount) : 0;
    balance += inAmt - outAmt;
    return { ...i, inAmt, outAmt, balance };
  });
  const exportCsv = () => downloadCsv(`so-tien-S2e-${fund}-${period.from}.csv`, ["Ngày", "Số hiệu", "Diễn giải", "Thu", "Chi", "Tồn"],
    [["", "", "Số dư đầu kỳ", "", "", Number(data?.summary.opening ?? 0)],
      ...lines.map((l) => [formatDateTime(l.occurredAt), l.code, `${l.category}${l.partnerName ? ` - ${l.partnerName}` : ""}`, l.inAmt, l.outAmt, l.balance])]);
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center gap-2"><div className="w-48"><NativeSelect value={fund} onChange={(e) => setFund(e.target.value)}>
        <option value="CASH">{t("books.fundCash")}</option><option value="BANK">{t("books.fundBank")}</option></NativeSelect></div>
        <span className="text-muted-foreground">{t("books.formPeriod", { code: "S2e-HKD", period: periodLabel(t, period), from: formatDate(period.from), to: formatDate(period.to) })}</span>
        {branchIds.length > 1 && <span className="text-xs text-destructive">{t("books.cashAllBranches")}</span>}
        <Button variant="outline" size="sm" className="ml-auto" onClick={exportCsv}><Download className="size-4" /> {tc("actions.export")}</Button></div>
      <table className="w-full border">
        <thead className="bg-muted/60"><tr><th className="border px-2 py-1.5 text-left">Ngày</th><th className="border px-2 text-left">Số hiệu</th>
          <th className="border px-2 text-left">Diễn giải</th><th className="border px-2 text-right">Thu</th><th className="border px-2 text-right">Chi</th><th className="border px-2 text-right">Tồn</th></tr></thead>
        <tbody>
          <tr className="font-medium"><td className="border px-2 py-1" colSpan={5}>Số dư đầu kỳ</td><td className="border px-2 text-right">{formatMoney(data?.summary.opening ?? 0)}</td></tr>
          {lines.map((l) => (
            <tr key={l.id}><td className="border px-2 py-1">{formatDateTime(l.occurredAt)}</td><td className="border px-2"><DocCodeLink code={l.code} className="print:text-inherit" /></td>
              <td className="border px-2">{l.category}{l.partnerName ? ` - ${l.partnerName}` : ""}</td>
              <td className="border px-2 text-right">{l.inAmt ? formatMoney(l.inAmt) : ""}</td><td className="border px-2 text-right">{l.outAmt ? formatMoney(l.outAmt) : ""}</td>
              <td className="border px-2 text-right">{formatMoney(l.balance)}</td></tr>
          ))}
          <tr className="font-semibold"><td className="border px-2 py-1" colSpan={3}>Cộng phát sinh / Số dư cuối kỳ</td>
            <td className="border px-2 text-right">{formatMoney(data?.summary.receipts ?? 0)}</td><td className="border px-2 text-right">{formatMoney(data?.summary.payments ?? 0)}</td>
            <td className="border px-2 text-right">{formatMoney(data?.summary.closing ?? 0)}</td></tr>
        </tbody>
      </table>
    </div>
  );
}
