"use client";

import Link from "next/link";
import { Truck } from "lucide-react";
import { StatusBadge } from "@/features/sales/invoice-list-kit";
import type { Invoice } from "@/features/sales/sales-types";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { SHIPMENT_TONE, shipmentStatusLabel } from "./delivery-types";

/** Chi tiết hóa đơn: kênh bán, bảng giá áp dụng và (Bán giao hàng) thông tin vận đơn: người nhận, đối tác, phí, thu hộ, trạng thái. */
export function InvoiceShipmentInfo({ inv }: { inv: Invoice }) {
  const s = inv.shipment;
  const cell = "flex min-h-[26px] items-center gap-2";
  return (
    <div className="space-y-2 text-xs">
      <div className="grid grid-cols-1 gap-x-8 md:grid-cols-3">
        <div className={cell}><span className="w-20 shrink-0">Kênh bán:</span>{inv.salesChannelName ?? "Bán trực tiếp"}</div>
        <div className={cell}><span className="w-20 shrink-0">Bảng giá:</span>{inv.priceBookName ?? "Bảng giá chung"}</div>
      </div>
      {s && (
        <div className="rounded-md border border-dashed border-primary/40 bg-[#f5f9ff] px-3 py-2">
          <div className="mb-1 flex flex-wrap items-center gap-3 text-[13px]">
            <Truck className="size-4 text-primary" /><b>Vận đơn {s.code}</b>
            <StatusBadge tone={SHIPMENT_TONE[s.status]}>{shipmentStatusLabel(s.status)}</StatusBadge>
            {s.returnCode && <StatusBadge tone="red">Phiếu trả hàng {s.returnCode}</StatusBadge>}
            <Link href="/delivery" className="ml-auto text-primary hover:underline">Quản lý giao hàng</Link>
          </div>
          <div className="grid grid-cols-1 gap-x-8 md:grid-cols-3">
            <div className={cell}><span className="w-24 shrink-0">Người nhận:</span>{s.receiverName} - {s.receiverPhone}</div>
            <div className={`${cell} md:col-span-2`}><span className="w-24 shrink-0">Địa chỉ:</span>{s.receiverAddress}{s.area ? ` (${s.area})` : ""}</div>
            <div className={cell}><span className="w-24 shrink-0">Đối tác:</span>{s.partnerName}</div>
            <div className={cell}><span className="w-24 shrink-0">Phí giao hàng:</span>
              {formatMoney(s.shippingFee)} ({s.feePayer === "SHOP" ? "cửa hàng trả" : "người nhận trả"})</div>
            <div className={cell}><span className="w-24 shrink-0">Thu hộ (COD):</span><b className="text-primary">{formatMoney(s.codAmount)}</b></div>
            {s.weightGram ? <div className={cell}><span className="w-24 shrink-0">Trọng lượng:</span>{formatNumber(s.weightGram)} g</div> : null}
            {s.deliveredAt && <div className={cell}><span className="w-24 shrink-0">Hoàn tất:</span>{formatDateTime(s.deliveredAt)}</div>}
            {s.note && <div className={`${cell} md:col-span-3`}><span className="w-24 shrink-0">Ghi chú:</span>{s.note}</div>}
          </div>
        </div>)}
    </div>
  );
}
