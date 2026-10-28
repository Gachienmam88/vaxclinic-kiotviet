"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import type { Receipt } from "./purchase-types";

const SEARCH = "h-[30px] w-full max-w-[150px] rounded-md border border-[#d1d5db] bg-background px-2.5 text-sm font-normal outline-none placeholder:text-muted-foreground focus-visible:border-primary";
const norm = (s: string) => s.toLocaleLowerCase("vi").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");

/** Bảng dòng hàng của phiếu nhập (nền tiêu đề #eff0f3) + hàng lọc "Tìm mã hàng / Tìm tên hàng" phía client. */
export function ReceiptLinesTable({ r }: { r: Receipt }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const lines = r.lines.filter((l) => norm(l.productCode).includes(norm(code)) && norm(l.productName).includes(norm(name)));
  return (
    <table className="w-full text-[13px]">
      <thead className="bg-[#eff0f3] text-left text-xs font-bold">
        <tr className="h-[30px]">
          <th className="px-2">Mã hàng</th><th className="px-2">Tên hàng</th><th className="px-2 text-right">Số lượng</th>
          <th className="px-2 text-right">Đơn giá</th><th className="px-2 text-right">Giảm giá</th>
          <th className="px-2 text-right">Giá nhập có VAT</th><th className="px-2 text-right">Thành tiền</th>
        </tr>
      </thead>
      <tbody>
        <tr className="border-b border-[#e5e7eb]">
          <td className="px-2 py-1.5"><input aria-label="Tìm mã hàng" placeholder="Tìm mã hàng" className={SEARCH} value={code} onChange={(e) => setCode(e.target.value)} /></td>
          <td className="px-2 py-1.5"><input aria-label="Tìm tên hàng" placeholder="Tìm tên hàng" className={SEARCH} value={name} onChange={(e) => setName(e.target.value)} /></td>
          <td colSpan={5} />
        </tr>
        {lines.map((l) => (
          <tr key={l.id} className="border-b border-[#e5e7eb] align-top hover:bg-[#edeef0]">
            <td className="px-2 py-2.5 text-primary">{l.productCode}</td>
            <td className="max-w-[220px] px-2 py-2.5">{l.productName} ({l.unitName})
              {l.lotNumber && <div className="text-xs text-muted-foreground">Lô {l.lotNumber} · HSD {formatDate(l.expiryDate)}</div>}</td>
            <td className="px-2 py-2.5 text-right">{formatNumber(l.quantity)}</td>
            <td className="px-2 py-2.5 text-right">{formatNumber(l.unitPrice)}</td>
            <td className="px-2 py-2.5 text-right">{Number(l.discount) ? formatNumber(l.discount) : ""}</td>
            <td className="px-2 py-2.5 text-right">{formatNumber(l.priceWithVat)}</td>
            <td className="px-2 py-2.5 text-right font-bold">{formatMoney(l.amount)}</td>
          </tr>
        ))}
        {!lines.length && <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">Không có hàng hóa phù hợp</td></tr>}
      </tbody>
    </table>
  );
}

/** Khối tổng bên phải: nhãn căn phải, giá trị căn phải (Số lượng mặt hàng → Tiền đã trả NCC). */
export function ReceiptSummary({ r }: { r: Receipt }) {
  const qty = r.lines.reduce((s, l) => s + Number(l.quantity), 0);
  const rows: [React.ReactNode, string][] = [
    ["Số lượng mặt hàng", String(r.lines.length)],
    [`Tổng tiền hàng (${formatNumber(qty)})`, formatMoney(r.subtotal)],
    [<span key="d" className="inline-flex items-center gap-1">Giảm giá <Info className="size-3.5 text-muted-foreground" aria-hidden /></span>, formatMoney(r.discount)],
    ...(r.vatRate != null ? [[`VAT ${formatNumber(r.vatRate)}%`, formatMoney(r.vatAmount)] as [string, string]] : []),
    ["Tổng cộng", formatMoney(r.total)],
    ["Tiền đã trả NCC", formatMoney(r.paidAmount)],
  ];
  return (
    <dl className="ml-auto grid w-[300px] shrink-0 grid-cols-[1fr_110px] gap-y-2.5 text-[13px]">
      {rows.map(([k, v], i) => (
        <div key={i} className="contents"><dt className="text-right">{k}</dt><dd className="text-right">{v}</dd></div>
      ))}
    </dl>
  );
}
