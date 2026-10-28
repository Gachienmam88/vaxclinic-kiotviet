/**
 * Dựng các dòng "Báo cáo cuối ngày về bán hàng": nhóm Hóa đơn / Trả hàng; hiển thị ngang tách tiếp theo phương thức
 * thanh toán (TM, CK, Thẻ, Ví, Ghi nợ) và với CK/Thẻ/Ví theo từng tài khoản nhận tiền. Thu khác, VAT, Làm tròn: ứng dụng
 * chưa có các khoản này trên hóa đơn → luôn 0. Nhãn theo ngôn ngữ đang chọn (t của namespace reports).
 */
import type { DocRow } from "./report-api";
import type { ReportColumn, ReportLine } from "./report-table";
import { DocCodeLink } from "@/components/ui/doc-code-link";
import type { ReportsT } from "@/messages/reports";

export type EodAgg = {
  code: string; customer: string; seller: string; time: string; qty: number; subtotal: number; discount: number;
  revenue: number; other: number; vat: number; rounding: number; fee: number; paid: number; debt: number;
};

const METHOD_ORDER = ["CASH", "TRANSFER", "CARD", "EWALLET", "DEBT"] as const;
type Method = (typeof METHOD_ORDER)[number];

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

const docAgg = (t: ReportsT, d: DocRow): EodAgg => ({
  code: d.code, customer: d.customerName ?? t("common.walkIn"), seller: d.sellerName ?? "", time: hhmm(d.time), qty: d.qty,
  subtotal: d.subtotal, discount: d.discount, revenue: d.revenue, other: 0, vat: 0, rounding: 0, fee: d.fee, paid: d.paid, debt: d.debt,
});

export function sumAgg(rows: DocRow[]): EodAgg {
  const a: EodAgg = { code: "", customer: "", seller: "", time: "", qty: 0, subtotal: 0, discount: 0, revenue: 0, other: 0, vat: 0, rounding: 0, fee: 0, paid: 0, debt: 0 };
  rows.forEach((r) => {
    a.qty += Number(r.qty); a.subtotal += Number(r.subtotal); a.discount += Number(r.discount); a.revenue += Number(r.revenue);
    a.fee += Number(r.fee); a.paid += Number(r.paid); a.debt += Number(r.debt);
  });
  return a;
}

const docLines = (t: ReportsT, rows: DocRow[], level: 1 | 2): ReportLine<EodAgg>[] =>
  rows.map((d) => ({ id: d.id, kind: "row", data: docAgg(t, d), level }));

function byMethod(t: ReportsT, prefix: string, rows: DocRow[]): ReportLine<EodAgg>[] {
  const groups = new Map<string, DocRow[]>();
  rows.forEach((r) => { const k = r.method ?? "DEBT"; groups.set(k, [...(groups.get(k) ?? []), r]); });
  return METHOD_ORDER.filter((m) => groups.has(m)).map((m: Method) => {
    const list = groups.get(m)!;
    let children: ReportLine<EodAgg>[];
    if (m === "CASH" || m === "DEBT") children = docLines(t, list, 2);
    else {
      const banks = new Map<string, DocRow[]>();
      list.forEach((r) => { const k = r.bankLabel ?? t("eod.noAccount"); banks.set(k, [...(banks.get(k) ?? []), r]); });
      children = [...banks.entries()].map(([bank, docs]) => ({
        id: `${prefix}-${m}-${bank}`, kind: "sub", level: 2, label: bank, data: sumAgg(docs), children: docLines(t, docs, 2),
      }));
    }
    return { id: `${prefix}-${m}`, kind: "sub", level: 1, label: t(`methodShort.${m}`), data: sumAgg(list), children };
  });
}

/** horizontal: nhóm → phương thức → (tài khoản) → chứng từ; dọc: nhóm → chứng từ. */
export function eodSalesLines(t: ReportsT, rows: DocRow[], horizontal: boolean): ReportLine<EodAgg>[] {
  const out: ReportLine<EodAgg>[] = [];
  const add = (kind: "INVOICE" | "RETURN", name: string) => {
    const list = rows.filter((r) => r.kind === kind);
    if (!list.length) return;
    out.push({ id: kind, kind: "group", label: t("eod.groupCount", { name, n: list.length }), data: sumAgg(list),
      children: horizontal ? byMethod(t, kind, list) : docLines(t, list, 1) });
  };
  add("INVOICE", t("eod.invoices"));
  add("RETURN", t("eod.returns"));
  return out;
}

const m = (key: keyof EodAgg, label: string, width?: number): ReportColumn<EodAgg> => ({ key, label, type: "money", width, value: (r) => r[key] });

const codeCol = (label: string): ReportColumn<EodAgg> => ({ key: "code", label, value: (r) => r.code, render: (r) => <DocCodeLink code={r.code} /> });

export const eodVerticalColumns = (t: ReportsT): ReportColumn<EodAgg>[] => [
  codeCol(t("cols.txCode")), { key: "time", label: t("cols.time"), value: (r) => r.time },
  { key: "qty", label: t("cols.qty"), type: "qty", value: (r) => r.qty }, m("revenue", t("cols.revenue")), m("other", t("cols.otherIncome")),
  m("vat", t("cols.vat")), m("rounding", t("cols.rounding")), m("fee", t("cols.returnFee")), m("paid", t("cols.paid")),
];

export const eodHorizontalColumns = (t: ReportsT): ReportColumn<EodAgg>[] => [
  codeCol(t("cols.docCode")), { key: "customer", label: t("cols.customer"), value: (r) => r.customer },
  { key: "seller", label: t("cols.employee"), value: (r) => r.seller }, { key: "time", label: t("cols.time"), value: (r) => r.time },
  { key: "qty", label: t("cols.qty"), type: "qty", value: (r) => r.qty }, m("subtotal", t("cols.subtotal")), m("discount", t("cols.discount")),
  m("revenue", t("cols.revenue")), m("other", t("cols.otherIncome")), m("vat", t("cols.vat")), m("rounding", t("cols.rounding")),
  m("fee", t("cols.returnFee")), m("paid", t("cols.paid")), m("debt", t("cols.debt")),
];
