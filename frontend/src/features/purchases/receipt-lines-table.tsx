"use client";

import { useState } from "react";
import Link from "next/link";
import { Tag } from "lucide-react";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import type { Receipt } from "./purchase-types";
import { commonVatRate } from "./purchase-math";
import { DocCodeLink } from "@/components/ui/doc-code-link";
import { ListEmptyRow } from "@/components/ui/list-empty-state";
import { useT } from "@/lib/i18n";
import { purchasesNs } from "@/messages/purchases";

const SEARCH = "h-[30px] w-full max-w-[150px] rounded-md border border-[#d1d5db] bg-background px-2.5 text-sm font-normal outline-none placeholder:text-muted-foreground focus-visible:border-primary";
const norm = (s: string) => s.toLocaleLowerCase("vi").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");

/**
 * Bảng dòng hàng của phiếu nhập (nền tiêu đề #eff0f3) + hàng lọc "Tìm mã hàng / Tìm tên hàng" phía client.
 * Mỗi dòng có biểu tượng nhãn giá → Thiết lập giá lọc sẵn theo mã hàng (KiotViet).
 */
export function ReceiptLinesTable({ r }: { r: Receipt }) {
  const t = useT(purchasesNs);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const lines = r.lines.filter((l) => norm(l.productCode).includes(norm(code)) && norm(l.productName).includes(norm(name)));
  return (
    <table className="w-full text-[13px]">
      <thead className="bg-[#eff0f3] text-left text-xs font-bold">
        <tr className="h-[30px]">
          <th className="px-2">{t("lines.productCode")}</th><th className="px-2">{t("lines.productName")}</th>
          <th className="px-2 text-right">{t("lines.quantity")}</th>
          <th className="px-2 text-right">{t("lines.unitPrice")}</th><th className="px-2 text-right">{t("lines.discount")}</th>
          <th className="px-2 text-right">{t("lines.priceWithVat")}</th><th className="px-2 text-right">{t("lines.amount")}</th>
          <th className="w-8" />
        </tr>
      </thead>
      <tbody>
        <tr className="border-b border-[#e5e7eb]">
          <td className="px-2 py-1.5"><input aria-label={t("lines.searchCode")} placeholder={t("lines.searchCode")} className={SEARCH} value={code} onChange={(e) => setCode(e.target.value)} /></td>
          <td className="px-2 py-1.5"><input aria-label={t("lines.searchName")} placeholder={t("lines.searchName")} className={SEARCH} value={name} onChange={(e) => setName(e.target.value)} /></td>
          <td colSpan={6} />
        </tr>
        {lines.map((l) => (
          <tr key={l.id} className="border-b border-[#e5e7eb] align-top hover:bg-[#edeef0]">
            <td className="px-2 py-2.5"><DocCodeLink code={l.productCode} /></td>
            <td className="max-w-[220px] px-2 py-2.5">{l.productName} ({l.unitName})
              {l.lotNumber && <div className="text-xs text-muted-foreground">{t("lines.lotInfo", { lot: l.lotNumber, expiry: formatDate(l.expiryDate) })}</div>}</td>
            <td className="px-2 py-2.5 text-right">{formatNumber(l.quantity)}</td>
            <td className="px-2 py-2.5 text-right">{formatNumber(l.unitPrice)}</td>
            <td className="px-2 py-2.5 text-right">{Number(l.discount) ? formatNumber(l.discount) : ""}</td>
            <td className="px-2 py-2.5 text-right">{formatNumber(l.priceWithVat)}</td>
            <td className="px-2 py-2.5 text-right font-bold">{formatMoney(l.amount)}</td>
            <td className="px-1 py-2.5 text-center">
              <Link href={`/products/price-books?code=${encodeURIComponent(l.productCode)}`} prefetch={false}
                aria-label={t("detail.priceSetupLine", { code: l.productCode })} title={t("detail.priceSetupLine", { code: l.productCode })}
                className="inline-flex text-[#2171bc] hover:text-[#1a9dcc]"><Tag className="size-4" /></Link>
            </td>
          </tr>
        ))}
        {!lines.length && <ListEmptyRow cols={8} what={t("lines.emptyWhat")} compact />}
      </tbody>
    </table>
  );
}

/** Khối tổng bên phải: nhãn căn phải, giá trị căn phải (Số lượng mặt hàng → Tiền đã trả NCC). */
export function ReceiptSummary({ r }: { r: Receipt }) {
  const t = useT(purchasesNs);
  const qty = r.lines.reduce((s, l) => s + Number(l.quantity), 0);
  const common = commonVatRate(r.vatMode ?? "LINE", r.lines.map((l) => (l.vatRate == null ? null : Number(l.vatRate))));
  const rows: [string, string][] = [
    [t("summary.itemCount"), String(r.lines.length)],
    [t("summary.subtotalQty", { qty: formatNumber(qty) }), formatMoney(r.subtotal)],
    [t("lines.discount"), formatMoney(r.discount)],
    // Mọi dòng cùng 1 mức VAT → "VAT x%"; lẫn mức / VAT nhập tay → "VAT" kèm số tiền (ẩn khi không có VAT)
    ...(common != null ? [[t("summary.vatRate", { rate: formatNumber(common) }), formatMoney(r.vatAmount)] as [string, string]]
      : Number(r.vatAmount) ? [["VAT", formatMoney(r.vatAmount)] as [string, string]] : []),
    [t("summary.total"), formatMoney(r.total)],
    [t("receipts.cols.paid"), formatMoney(r.paidAmount)],
  ];
  return (
    <dl className="ml-auto grid w-[300px] shrink-0 grid-cols-[1fr_110px] gap-y-2.5 text-[13px]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents"><dt className="text-right">{k}</dt><dd className="text-right">{v}</dd></div>
      ))}
    </dl>
  );
}
