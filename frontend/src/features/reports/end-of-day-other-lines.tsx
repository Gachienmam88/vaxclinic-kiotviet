/**
 * Báo cáo cuối ngày – các mối quan tâm Thu chi (phiếu thu/chi Sổ quỹ), Hàng hóa (bán / trả theo mặt hàng) và Tổng hợp.
 * Nhãn theo ngôn ngữ đang chọn (t của namespace reports); tên tài khoản ngân hàng, đối tác, hàng hóa là dữ liệu.
 */
import { sumOf, type DocRow, type ProductRow, type VoucherRow } from "./report-api";
import type { ReportColumn, ReportLine } from "./report-table";
import { DocCodeLink } from "@/components/ui/doc-code-link";
import type { ReportsT } from "@/messages/reports";

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
const FUNDS = ["CASH", "BANK", "EWALLET"] as const;
const fundLabel = (t: ReportsT, v: VoucherRow) =>
  v.bankLabel ?? ((FUNDS as readonly string[]).includes(v.fund) ? t(`funds.${v.fund as (typeof FUNDS)[number]}`) : v.fund);

export type CashAgg = { code: string; category: string; partner: string; time: string; fund: string; receipt: number; payment: number };

const vAgg = (t: ReportsT, v: VoucherRow): CashAgg => ({
  code: v.code, category: v.category, partner: v.partnerName ?? "", time: hhmm(v.time), fund: fundLabel(t, v),
  receipt: v.voucherType === "RECEIPT" ? Number(v.amount) : 0, payment: v.voucherType === "PAYMENT" ? Number(v.amount) : 0,
});
const cashSum = (list: VoucherRow[]): CashAgg => ({
  code: "", category: "", partner: "", time: "", fund: "",
  receipt: sumOf(list.filter((v) => v.voucherType === "RECEIPT"), (v) => v.amount),
  payment: sumOf(list.filter((v) => v.voucherType === "PAYMENT"), (v) => v.amount),
});

/** Nhóm Phiếu thu / Phiếu chi; hiển thị ngang tách thêm theo quỹ (Tiền mặt / từng tài khoản ngân hàng / ví). */
export function eodCashLines(t: ReportsT, rows: VoucherRow[], horizontal: boolean): ReportLine<CashAgg>[] {
  return (["RECEIPT", "PAYMENT"] as const).flatMap((type) => {
    const list = rows.filter((v) => v.voucherType === type);
    if (!list.length) return [];
    const docs = (l: VoucherRow[], level: 1 | 2) => l.map((v) => ({ id: v.id, kind: "row" as const, level, data: vAgg(t, v) }));
    let children: ReportLine<CashAgg>[] = docs(list, 1);
    if (horizontal) {
      const funds = new Map<string, VoucherRow[]>();
      list.forEach((v) => { const k = fundLabel(t, v); funds.set(k, [...(funds.get(k) ?? []), v]); });
      children = [...funds.entries()].map(([f, l]) => ({ id: `${type}-${f}`, kind: "sub", level: 1, label: f, data: cashSum(l), children: docs(l, 2) }));
    }
    const name = type === "RECEIPT" ? t("eod.receipts") : t("eod.payments");
    return [{ id: type, kind: "group" as const, label: t("eod.groupCount", { name, n: list.length }), data: cashSum(list), children }];
  });
}

const money = <T,>(key: string, label: string, f: (r: T) => number): ReportColumn<T> => ({ key, label, type: "money", value: f });

export const eodCashColumns = (t: ReportsT): ReportColumn<CashAgg>[] => [
  { key: "code", label: t("cols.voucherCode"), value: (r) => r.code, render: (r) => <DocCodeLink code={r.code} /> },
  { key: "category", label: t("cols.cashCategory"), value: (r) => r.category }, { key: "partner", label: t("cols.partner"), value: (r) => r.partner },
  { key: "time", label: t("cols.time"), value: (r) => r.time }, money("receipt", t("cols.receipt"), (r) => r.receipt),
  money("payment", t("cols.payment"), (r) => r.payment),
];

export type ProductAgg = { code: string; name: string; qtySold: number; revenue: number; qtyReturned: number; returnValue: number; net: number };

export const productAgg = (p: ProductRow): ProductAgg => ({
  code: p.code, name: p.unit ? `${p.name} (${p.unit})` : p.name, qtySold: Number(p.qtySold), revenue: Number(p.revenue),
  qtyReturned: Number(p.qtyReturned), returnValue: Number(p.returnValue), net: Number(p.revenue) - Number(p.returnValue),
});

/** Dòng tổng "SL mặt hàng: N" + từng mặt hàng. */
export function productLines(t: ReportsT, rows: ProductRow[]): ReportLine<ProductAgg>[] {
  const list = rows.map(productAgg);
  const sum: ProductAgg = { code: "", name: "", qtySold: sumOf(list, (r) => r.qtySold), revenue: sumOf(list, (r) => r.revenue),
    qtyReturned: sumOf(list, (r) => r.qtyReturned), returnValue: sumOf(list, (r) => r.returnValue), net: sumOf(list, (r) => r.net) };
  return list.length ? [{ id: "sum", kind: "sum", label: t("common.itemCount", { n: list.length }), data: sum },
    ...list.map((p, i) => ({ id: `${p.code}-${i}`, kind: "row" as const, data: p }))] : [];
}

export const eodProductColumns = (t: ReportsT): ReportColumn<ProductAgg>[] => [
  { key: "code", label: t("cols.productCode"), value: (r) => r.code, render: (r) => <b><DocCodeLink code={r.code} /></b> },
  { key: "name", label: t("cols.productName"), value: (r) => r.name, width: 130 },
  { key: "qtySold", label: t("cols.qtySold"), type: "qty", value: (r) => r.qtySold }, money("revenue", t("cols.revenue"), (r) => r.revenue),
  { key: "qtyReturned", label: t("cols.qtyReturned"), type: "qty", value: (r) => r.qtyReturned },
  money("returnValue", t("cols.returnValue"), (r) => r.returnValue), money("net", t("cols.net"), (r) => r.net),
];

export type SummaryAgg = { name: string; count: number | string; value: number | "" };

/** Tổng hợp cuối ngày: bán hàng, trả hàng, thực thu, thu chi theo quỹ, hàng hóa. */
export function eodSummaryLines(t: ReportsT, docs: DocRow[], vouchers: VoucherRow[], products: ProductRow[]): ReportLine<SummaryAgg>[] {
  const inv = docs.filter((d) => d.kind === "INVOICE"), ret = docs.filter((d) => d.kind === "RETURN");
  const rec = vouchers.filter((v) => v.voucherType === "RECEIPT"), pay = vouchers.filter((v) => v.voucherType === "PAYMENT");
  const fund = (f: string) => sumOf(rec.filter((v) => v.fund === f), (v) => v.amount) - sumOf(pay.filter((v) => v.fund === f), (v) => v.amount);
  const row = (id: keyof typeof SUMMARY_IDS, count: number | string, value: number | "", kind: "group" | "row" = "row"): ReportLine<SummaryAgg> =>
    ({ id, kind, data: { name: t(`eod.summary.${SUMMARY_IDS[id]}`), count, value }, level: kind === "row" ? 1 : 0 });
  return [
    row("s", "", "", "group"),
    row("inv", inv.length, sumOf(inv, (d) => d.revenue)),
    row("ret", ret.length, -sumOf(ret, (d) => d.revenue)),
    row("fee", "", sumOf(ret, (d) => d.fee)),
    row("net", "", sumOf(docs, (d) => d.revenue)),
    row("paid", "", sumOf(docs, (d) => d.paid)),
    row("debt", "", sumOf(docs, (d) => d.debt)),
    row("c", "", "", "group"),
    row("rec", rec.length, sumOf(rec, (v) => v.amount)),
    row("pay", pay.length, sumOf(pay, (v) => v.amount)),
    row("cash", "", fund("CASH")),
    row("bank", "", fund("BANK")),
    row("wallet", "", fund("EWALLET")),
    row("h", "", "", "group"),
    row("items", products.length, sumOf(products, (p) => Number(p.revenue) - Number(p.returnValue))),
    row("qty", sumOf(products, (p) => p.qtySold), ""),
    row("qtyr", sumOf(products, (p) => p.qtyReturned), ""),
  ];
}

/** id dòng tổng hợp → khóa "eod.summary.<…>". */
const SUMMARY_IDS = {
  s: "salesGroup", inv: "invoices", ret: "returns", fee: "returnFee", net: "net", paid: "paid", debt: "debt", c: "cashGroup",
  rec: "receipts", pay: "payments", cash: "cashNet", bank: "bankNet", wallet: "walletNet", h: "productsGroup", items: "itemCount",
  qty: "qtySold", qtyr: "qtyReturned",
} as const;

export const eodSummaryColumns = (t: ReportsT): ReportColumn<SummaryAgg>[] => [
  { key: "name", label: t("cols.metric"), value: (r) => r.name }, { key: "count", label: t("cols.count"), type: "qty", value: (r) => r.count },
  { key: "value", label: t("cols.value"), type: "money", value: (r) => r.value },
];
