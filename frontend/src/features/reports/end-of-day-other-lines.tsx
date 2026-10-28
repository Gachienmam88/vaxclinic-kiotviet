/**
 * Báo cáo cuối ngày – các mối quan tâm Thu chi (phiếu thu/chi Sổ quỹ), Hàng hóa (bán / trả theo mặt hàng) và Tổng hợp.
 */
import { sumOf, type DocRow, type ProductRow, type VoucherRow } from "./report-api";
import type { ReportColumn, ReportLine } from "./report-table";
import { DocCodeLink } from "@/components/ui/doc-code-link";

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
const FUND: Record<string, string> = { CASH: "Tiền mặt", BANK: "Ngân hàng", EWALLET: "Ví điện tử" };

export type CashAgg = { code: string; category: string; partner: string; time: string; fund: string; receipt: number; payment: number };

const vAgg = (v: VoucherRow): CashAgg => ({
  code: v.code, category: v.category, partner: v.partnerName ?? "", time: hhmm(v.time), fund: v.bankLabel ?? FUND[v.fund] ?? v.fund,
  receipt: v.voucherType === "RECEIPT" ? Number(v.amount) : 0, payment: v.voucherType === "PAYMENT" ? Number(v.amount) : 0,
});
const cashSum = (list: VoucherRow[]): CashAgg => ({
  code: "", category: "", partner: "", time: "", fund: "",
  receipt: sumOf(list.filter((v) => v.voucherType === "RECEIPT"), (v) => v.amount),
  payment: sumOf(list.filter((v) => v.voucherType === "PAYMENT"), (v) => v.amount),
});

/** Nhóm Phiếu thu / Phiếu chi; hiển thị ngang tách thêm theo quỹ (Tiền mặt / từng tài khoản ngân hàng / ví). */
export function eodCashLines(rows: VoucherRow[], horizontal: boolean): ReportLine<CashAgg>[] {
  return (["RECEIPT", "PAYMENT"] as const).flatMap((t) => {
    const list = rows.filter((v) => v.voucherType === t);
    if (!list.length) return [];
    const docs = (l: VoucherRow[], level: 1 | 2) => l.map((v) => ({ id: v.id, kind: "row" as const, level, data: vAgg(v) }));
    let children: ReportLine<CashAgg>[] = docs(list, 1);
    if (horizontal) {
      const funds = new Map<string, VoucherRow[]>();
      list.forEach((v) => { const k = v.bankLabel ?? FUND[v.fund] ?? v.fund; funds.set(k, [...(funds.get(k) ?? []), v]); });
      children = [...funds.entries()].map(([f, l]) => ({ id: `${t}-${f}`, kind: "sub", level: 1, label: f, data: cashSum(l), children: docs(l, 2) }));
    }
    return [{ id: t, kind: "group" as const, label: `${t === "RECEIPT" ? "Phiếu thu" : "Phiếu chi"}: ${list.length}`, data: cashSum(list), children }];
  });
}

const money = <T,>(key: string, label: string, f: (r: T) => number): ReportColumn<T> => ({ key, label, type: "money", value: f });

export const EOD_CASH_COLUMNS: ReportColumn<CashAgg>[] = [
  { key: "code", label: "Mã phiếu", value: (r) => r.code, render: (r) => <DocCodeLink code={r.code} /> },
  { key: "category", label: "Loại thu chi", value: (r) => r.category }, { key: "partner", label: "Người nộp/nhận", value: (r) => r.partner },
  { key: "time", label: "Thời gian", value: (r) => r.time }, money("receipt", "Thu", (r) => r.receipt), money("payment", "Chi", (r) => r.payment),
];

export type ProductAgg = { code: string; name: string; qtySold: number; revenue: number; qtyReturned: number; returnValue: number; net: number };

export const productAgg = (p: ProductRow): ProductAgg => ({
  code: p.code, name: p.unit ? `${p.name} (${p.unit})` : p.name, qtySold: Number(p.qtySold), revenue: Number(p.revenue),
  qtyReturned: Number(p.qtyReturned), returnValue: Number(p.returnValue), net: Number(p.revenue) - Number(p.returnValue),
});

/** Dòng tổng "SL mặt hàng: N" + từng mặt hàng. */
export function productLines(rows: ProductRow[]): ReportLine<ProductAgg>[] {
  const list = rows.map(productAgg);
  const sum: ProductAgg = { code: "", name: "", qtySold: sumOf(list, (r) => r.qtySold), revenue: sumOf(list, (r) => r.revenue),
    qtyReturned: sumOf(list, (r) => r.qtyReturned), returnValue: sumOf(list, (r) => r.returnValue), net: sumOf(list, (r) => r.net) };
  return list.length ? [{ id: "sum", kind: "sum", label: `SL mặt hàng: ${list.length}`, data: sum },
    ...list.map((p, i) => ({ id: `${p.code}-${i}`, kind: "row" as const, data: p }))] : [];
}

export const PRODUCT_COLUMNS: ReportColumn<ProductAgg>[] = [
  { key: "code", label: "Mã hàng", value: (r) => r.code, render: (r) => <b><DocCodeLink code={r.code} /></b> },
  { key: "name", label: "Tên hàng", value: (r) => r.name, width: 130 },
  { key: "qtySold", label: "SL Bán", type: "qty", value: (r) => r.qtySold }, money("revenue", "Doanh thu", (r) => r.revenue),
  { key: "qtyReturned", label: "SL Trả", type: "qty", value: (r) => r.qtyReturned }, money("returnValue", "Giá trị trả", (r) => r.returnValue),
  money("net", "Doanh thu thuần", (r) => r.net),
];

export type SummaryAgg = { name: string; count: number | string; value: number | "" };

/** Tổng hợp cuối ngày: bán hàng, trả hàng, thực thu, thu chi theo quỹ, hàng hóa. */
export function eodSummaryLines(docs: DocRow[], vouchers: VoucherRow[], products: ProductRow[]): ReportLine<SummaryAgg>[] {
  const inv = docs.filter((d) => d.kind === "INVOICE"), ret = docs.filter((d) => d.kind === "RETURN");
  const rec = vouchers.filter((v) => v.voucherType === "RECEIPT"), pay = vouchers.filter((v) => v.voucherType === "PAYMENT");
  const fund = (f: string) => sumOf(rec.filter((v) => v.fund === f), (v) => v.amount) - sumOf(pay.filter((v) => v.fund === f), (v) => v.amount);
  const row = (id: string, name: string, count: number | string, value: number | "", kind: "group" | "row" = "row"): ReportLine<SummaryAgg> =>
    ({ id, kind, data: { name, count, value }, level: kind === "row" ? 1 : 0 });
  return [
    row("s", "Bán hàng", "", "", "group"),
    row("inv", "Hóa đơn", inv.length, sumOf(inv, (d) => d.revenue)),
    row("ret", "Trả hàng", ret.length, -sumOf(ret, (d) => d.revenue)),
    row("fee", "Phí trả hàng", "", sumOf(ret, (d) => d.fee)),
    row("net", "Doanh thu thuần", "", sumOf(docs, (d) => d.revenue)),
    row("paid", "Thực thu", "", sumOf(docs, (d) => d.paid)),
    row("debt", "Ghi nợ", "", sumOf(docs, (d) => d.debt)),
    row("c", "Thu chi", "", "", "group"),
    row("rec", "Phiếu thu", rec.length, sumOf(rec, (v) => v.amount)),
    row("pay", "Phiếu chi", pay.length, sumOf(pay, (v) => v.amount)),
    row("cash", "Tiền mặt (thu − chi)", "", fund("CASH")),
    row("bank", "Ngân hàng (thu − chi)", "", fund("BANK")),
    row("wallet", "Ví điện tử (thu − chi)", "", fund("EWALLET")),
    row("h", "Hàng hóa", "", "", "group"),
    row("items", "Số mặt hàng", products.length, sumOf(products, (p) => Number(p.revenue) - Number(p.returnValue))),
    row("qty", "Số lượng bán", sumOf(products, (p) => p.qtySold), ""),
    row("qtyr", "Số lượng trả", sumOf(products, (p) => p.qtyReturned), ""),
  ];
}

export const SUMMARY_COLUMNS: ReportColumn<SummaryAgg>[] = [
  { key: "name", label: "Chỉ tiêu", value: (r) => r.name }, { key: "count", label: "Số lượng", type: "qty", value: (r) => r.count },
  { key: "value", label: "Giá trị", type: "money", value: (r) => r.value },
];
