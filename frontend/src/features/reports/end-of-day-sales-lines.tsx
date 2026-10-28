/**
 * Dựng các dòng "Báo cáo cuối ngày về bán hàng": nhóm Hóa đơn / Trả hàng; hiển thị ngang tách tiếp theo phương thức
 * thanh toán (TM, CK, Thẻ, Ví, Ghi nợ) và với CK/Thẻ/Ví theo từng tài khoản nhận tiền. Thu khác, VAT, Làm tròn: ứng dụng
 * chưa có các khoản này trên hóa đơn → luôn 0.
 */
import type { DocRow } from "./report-api";
import type { ReportColumn, ReportLine } from "./report-table";
import { DocCodeLink } from "@/components/ui/doc-code-link";

export type EodAgg = {
  code: string; customer: string; seller: string; time: string; qty: number; subtotal: number; discount: number;
  revenue: number; other: number; vat: number; rounding: number; fee: number; paid: number; debt: number;
};

const METHOD_LABEL: Record<string, string> = { CASH: "TM", TRANSFER: "CK", CARD: "Thẻ", EWALLET: "Ví", DEBT: "Ghi nợ" };
const METHOD_ORDER = ["CASH", "TRANSFER", "CARD", "EWALLET", "DEBT"];

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

const docAgg = (d: DocRow): EodAgg => ({
  code: d.code, customer: d.customerName ?? "Khách lẻ", seller: d.sellerName ?? "", time: hhmm(d.time), qty: d.qty,
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

const docLines = (rows: DocRow[], level: 1 | 2): ReportLine<EodAgg>[] =>
  rows.map((d) => ({ id: d.id, kind: "row", data: docAgg(d), level }));

function byMethod(prefix: string, rows: DocRow[]): ReportLine<EodAgg>[] {
  const groups = new Map<string, DocRow[]>();
  rows.forEach((r) => { const k = r.method ?? "DEBT"; groups.set(k, [...(groups.get(k) ?? []), r]); });
  return METHOD_ORDER.filter((m) => groups.has(m)).map((m) => {
    const list = groups.get(m)!;
    let children: ReportLine<EodAgg>[];
    if (m === "CASH" || m === "DEBT") children = docLines(list, 2);
    else {
      const banks = new Map<string, DocRow[]>();
      list.forEach((r) => { const k = r.bankLabel ?? "Không chọn tài khoản"; banks.set(k, [...(banks.get(k) ?? []), r]); });
      children = [...banks.entries()].map(([bank, docs]) => ({
        id: `${prefix}-${m}-${bank}`, kind: "sub", level: 2, label: bank, data: sumAgg(docs), children: docLines(docs, 2),
      }));
    }
    return { id: `${prefix}-${m}`, kind: "sub", level: 1, label: METHOD_LABEL[m], data: sumAgg(list), children };
  });
}

/** horizontal: nhóm → phương thức → (tài khoản) → chứng từ; dọc: nhóm → chứng từ. */
export function eodSalesLines(rows: DocRow[], horizontal: boolean): ReportLine<EodAgg>[] {
  const out: ReportLine<EodAgg>[] = [];
  const add = (kind: "INVOICE" | "RETURN", name: string) => {
    const list = rows.filter((r) => r.kind === kind);
    if (!list.length) return;
    out.push({ id: kind, kind: "group", label: `${name}: ${list.length}`, data: sumAgg(list),
      children: horizontal ? byMethod(kind, list) : docLines(list, 1) });
  };
  add("INVOICE", "Hóa đơn");
  add("RETURN", "Trả hàng");
  return out;
}

const m = (key: keyof EodAgg, label: string, width?: number): ReportColumn<EodAgg> => ({ key, label, type: "money", width, value: (r) => r[key] });

const codeCol = (label: string): ReportColumn<EodAgg> => ({ key: "code", label, value: (r) => r.code, render: (r) => <DocCodeLink code={r.code} /> });

export const EOD_VERTICAL: ReportColumn<EodAgg>[] = [
  codeCol("Mã giao dịch"), { key: "time", label: "Thời gian", value: (r) => r.time },
  { key: "qty", label: "SL", type: "qty", value: (r) => r.qty }, m("revenue", "Doanh thu"), m("other", "Thu khác"), m("vat", "VAT"),
  m("rounding", "Làm tròn"), m("fee", "Phí trả hàng"), m("paid", "Thực thu"),
];

export const EOD_HORIZONTAL: ReportColumn<EodAgg>[] = [
  codeCol("Mã chứng từ"), { key: "customer", label: "Khách hàng", value: (r) => r.customer },
  { key: "seller", label: "Nhân viên", value: (r) => r.seller }, { key: "time", label: "Thời gian", value: (r) => r.time },
  { key: "qty", label: "SL", type: "qty", value: (r) => r.qty }, m("subtotal", "Tổng tiền hàng"), m("discount", "Giảm giá"),
  m("revenue", "Doanh thu"), m("other", "Thu khác"), m("vat", "VAT"), m("rounding", "Làm tròn"), m("fee", "Phí trả hàng"),
  m("paid", "Thực thu"), m("debt", "Ghi nợ"),
];
