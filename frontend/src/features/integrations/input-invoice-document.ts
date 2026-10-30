import { amountInWords } from "@/features/print/print-render";
import { formatMoney, formatNumber } from "@/lib/format";
import type { InputInvoice, InputInvoiceLine } from "./integration-queries";

/**
 * HTML "Chi tiết hóa đơn điện tử" (hiển thị trong popup + in qua printHtml/sanitizeHtml). Nhãn giữ tiếng Việt vì là chứng từ
 * thuế. Mọi giá trị được escape; trường không có → "-". Không dùng ảnh nền / hình trang trí.
 */
const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const dash = (v: unknown) => (v == null || String(v).trim() === "" ? "-" : esc(v));
const num = (v: number | null | undefined) => (v == null ? "-" : esc(formatNumber(Number(v))));
const money = (v: number | null | undefined) => (v == null ? "-" : esc(formatMoney(Number(v))));

const NATURE: Record<string, string> = { "1": "Hàng hóa, dịch vụ", "2": "Khuyến mại", "3": "Chiết khấu thương mại", "4": "Ghi chú" };

const CELL = "border:1px solid #333;padding:4px 5px;vertical-align:top";
const row = (label: string, value: string) =>
  `<tr><td style="width:150px;padding:3px 0;vertical-align:top">${label}:</td><td style="padding:3px 0">${value}</td></tr>`;

function rateSummary(inv: InputInvoice) {
  const rates: { rate: string | null; beforeTax: number | null; tax: number | null }[] =
    inv.details?.rates?.length ? inv.details.rates : computeRates(inv.lines);
  return rates.map((r) => `<tr><td style="${CELL};text-align:center">${dash(r.rate)}</td><td style="${CELL};text-align:right">${money(r.beforeTax)}</td>`
    + `<td style="${CELL};text-align:right">${money(r.tax)}</td></tr>`).join("");
}

function computeRates(lines: InputInvoiceLine[]) {
  const map = new Map<string, { rate: string; beforeTax: number; tax: number }>();
  lines.forEach((l) => {
    const rate = l.vatRate ?? "KCT";
    const amount = Number(l.amount ?? 0);
    const pct = Number(/(\d+(?:\.\d+)?)/.exec(rate)?.[1] ?? 0);
    const cur = map.get(rate) ?? { rate, beforeTax: 0, tax: 0 };
    cur.beforeTax += amount;
    cur.tax += Math.round((amount * pct) / 100);
    map.set(rate, cur);
  });
  return [...map.values()];
}

export function buildInvoiceDocument(inv: InputInvoice): string {
  const d = inv.details ?? null;
  const date = inv.issuedAt ? inv.issuedAt.slice(0, 10).split("-") : ["", "", ""];
  const title = (d?.invoiceName || "Hóa đơn giá trị gia tăng").toUpperCase();
  const lines = inv.lines.map((l, i) => `<tr><td style="${CELL};text-align:center">${i + 1}</td><td style="${CELL}">${esc(NATURE[l.nature ?? "1"] ?? NATURE["1"])}</td>`
    + `<td style="${CELL}">${dash(l.name)}</td><td style="${CELL};text-align:center">${dash(l.unit)}</td><td style="${CELL};text-align:right">${num(l.quantity)}</td>`
    + `<td style="${CELL};text-align:right">${num(l.unitPrice)}</td><td style="${CELL};text-align:right">${num(l.discount ?? 0)}</td>`
    + `<td style="${CELL};text-align:center">${dash(l.vatRate)}</td><td style="${CELL};text-align:right">${money(l.amount)}</td>`
    + `<td style="${CELL};text-align:center">${dash(l.other)}</td></tr>`).join("");
  const head = ["STT", "Tính chất", "Tên hàng hóa, dịch vụ", "Đơn vị tính", "Số lượng", "Đơn giá", "Chiết khấu", "Thuế suất",
    "Thành tiền chưa có thuế GTGT", "Thông tin khác"].map((h) => `<th style="${CELL};text-align:center;font-weight:normal">${h}</th>`).join("");
  const words = inv.totalInWords || d?.totalInWords || amountInWords(Number(inv.total));
  const totals = [["Tổng tiền chưa thuế", money(inv.totalBeforeTax)], ["Tổng tiền thuế", money(inv.vatAmount)],
    ["Tổng tiền thanh toán bằng số", money(inv.total)], ["Tổng tiền thanh toán bằng chữ", esc(words)]]
    .map(([k, v]) => `<tr><td style="${CELL}">${k}</td><td style="${CELL};text-align:right">${v}</td></tr>`).join("");
  return `<style>@page { size: A4 portrait; margin: 10mm; }</style>
<div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#222;line-height:1.4">
<div style="text-align:right;font-size:11px">Mẫu số: ${dash(inv.templateNo)}<br>Ký hiệu: ${dash(inv.series)}<br>Số hóa đơn: ${dash(inv.number)}</div>
<div style="text-align:center;margin:4px 0 10px"><div style="font-size:18px;font-weight:bold">${esc(title)}</div>
<div>Ngày ${esc(date[2])} tháng ${esc(date[1])} năm ${esc(date[0])}</div><div>Mã CQT: ${dash(d?.taxAuthorityCode)}</div></div>
<div style="border-top:1px solid #e0c9a6;padding:10px 0"><table style="width:100%">
${row("Tên người bán", dash(inv.sellerName))}${row("Mã số thuế", dash(inv.sellerTaxCode))}${row("Mã cửa hàng", dash(d?.sellerStoreCode))}
${row("Tên cửa hàng", dash(d?.sellerStoreName))}${row("Địa chỉ", dash(inv.sellerAddress))}${row("Điện thoại", dash(d?.sellerPhone))}
${row("Số tài khoản", dash(d?.sellerBankAccount))}</table></div>
<div style="border-top:1px solid #e0c9a6;padding:10px 0"><table style="width:100%">
${row("Tên người mua", dash(d?.buyerName))}${row("Họ tên người mua hàng", dash(d?.buyerPersonName))}${row("Mã số thuế", dash(inv.buyerTaxCode))}
${row("Mã ĐVQHNS", dash(d?.buyerBudgetCode))}${row("Số hộ chiếu", dash(d?.buyerPassport))}${row("Địa chỉ", dash(d?.buyerAddress))}
${row("Điện thoại", dash(d?.buyerPhone))}${row("CCCD người mua", dash(d?.buyerIdNumber))}${row("Hình thức thanh toán", dash(d?.paymentMethod))}
${row("Số tài khoản", dash(d?.buyerBankAccount))}</table></div>
<table style="width:100%;border-collapse:collapse;margin-top:6px"><thead><tr>${head}</tr></thead><tbody>${lines}</tbody></table>
<table style="width:100%;margin-top:12px;border-collapse:collapse"><tr>
<td style="width:58%;vertical-align:top;padding-right:10px"><table style="width:100%;border-collapse:collapse"><thead><tr>
<th style="${CELL};font-weight:normal">Thuế suất</th><th style="${CELL};font-weight:normal">Tổng tiền chưa thuế</th><th style="${CELL};font-weight:normal">Tổng tiền thuế</th>
</tr></thead><tbody>${rateSummary(inv)}</tbody></table></td>
<td style="vertical-align:top"><table style="width:100%;border-collapse:collapse">${totals}
<tr><td colspan="2" style="${CELL};text-align:center">Ghi chú</td></tr><tr><td colspan="2" style="${CELL};height:40px">${dash(d?.note)}</td></tr></table></td>
</tr></table>
<table style="margin-top:14px"><tr><td style="width:60px">DVKy</td><td>${dash(d?.signer)}</td></tr><tr><td>NVky</td><td>${dash(d?.signedAt)}</td></tr></table>
<table style="width:100%;margin-top:10px;text-align:center"><tr><td>Người Mua Hàng<br>(Chữ ký số (Nếu có))</td><td>NGƯỜI BÁN HÀNG<br>(Chữ ký số (Nếu có))</td></tr></table>
</div>`;
}
