"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, SquareArrowOutUpRight } from "lucide-react";
import { EInvoiceStatus } from "@/features/integrations/einvoice-status";
import { useEInvoiceRecords } from "@/features/integrations/integration-queries";
import { formatDateTime } from "@/lib/format";
import { EINVOICE_TONE, einvoiceLabel, einvoiceLookupUrl, einvoiceNumber, einvoiceState } from "./invoice-einvoice-state";
import { StatusBadge } from "./invoice-list-kit";
import type { Invoice } from "./sales-types";

const ROW = "grid grid-cols-[110px_1fr] items-start gap-2";

/** inv_date của MISA: "yyyy-MM-dd" hoặc ngày giờ ISO. */
const issuedAt = (v: string | null) => {
  if (!v) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : formatDateTime(v);
};

/**
 * Thẻ "Hoá đơn điện tử" (thu gọn được) trong chi tiết hóa đơn: trạng thái kiểu KiotViet (CQT chấp nhận / Đã phát hành /
 * Phát hành lỗi), số - ký hiệu (link tra cứu MISA), ngày phát hành, người mua, tính chất. Chưa phát hành: nút "Phát hành HĐĐT".
 */
export function InvoiceEInvoiceCard({ inv, active }: { inv: Invoice; active: boolean }) {
  const [open, setOpen] = useState(true);
  const { data = [] } = useEInvoiceRecords([inv.id]);
  const rec = data[0];
  if (!rec) return active ? <EInvoiceStatus invoiceId={inv.id} active={active} /> : null;
  const state = einvoiceState(rec);
  const url = einvoiceLookupUrl(rec);
  return (
    <div className="rounded-md border bg-[#f7f8fa] px-3 py-2.5 text-[13px]">
      <button type="button" className="flex w-full items-center gap-2 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
        <b>Hoá đơn điện tử</b><StatusBadge tone={EINVOICE_TONE[state]}>{einvoiceLabel(state)}</StatusBadge>
        {open ? <ChevronUp className="ml-auto size-4" /> : <ChevronDown className="ml-auto size-4" />}
      </button>
      {open && (state === "FAILED" ? (
        <div className="mt-3"><EInvoiceStatus invoiceId={inv.id} active={active} /></div>
      ) : (
        <div className="mt-3 space-y-2.5">
          <div className={ROW}><span>Hóa đơn:</span>
            <span className="inline-flex items-center gap-1">{einvoiceNumber(rec)}
              {url && <a href={url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary" aria-label="Tra cứu hóa đơn điện tử"
                title={`Tra cứu (mã ${rec.transaction_id})`}><SquareArrowOutUpRight className="size-3.5" /></a>}</span></div>
          <div className={ROW}><span>Ngày phát hành:</span><span>{issuedAt(rec.inv_date)}</span></div>
          <div className={ROW}><span>Người mua:</span><span>{[inv.customerName, inv.customerAddress].filter(Boolean).join(" / ")}</span></div>
          <div className={ROW}><span>Tính chất hóa đơn:</span><span>Gốc</span></div>
          {rec.inv_code && <div className={ROW}><span>Mã CQT:</span><span>{rec.inv_code}</span></div>}
        </div>))}
    </div>
  );
}
