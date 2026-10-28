"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DocCodeLink } from "@/components/ui/doc-code-link";
import { StatusBadge } from "@/features/sales/invoice-list-kit";
import type { Invoice } from "@/features/sales/sales-types";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { renderRichText } from "@/lib/i18n/render-rich-text";
import { useCurrentUser } from "@/lib/use-current-user";
import { deliveryNs } from "@/messages/delivery";
import { FEE_PAYER_KEY, SHIPMENT_STATUS_KEY, SHIPMENT_TONE } from "./delivery-types";
import { ShipmentCreateDialog } from "./shipment-create-dialog";

/**
 * Chi tiết hóa đơn: kênh bán, bảng giá áp dụng và (Bán giao hàng) thông tin vận đơn: người nhận, đối tác, phí, thu hộ, trạng thái.
 * Vận đơn đã hủy (hóa đơn vẫn Hoàn thành) → "Chưa giao" + nút "Tạo vận đơn" (giao lại, có thể qua đối tác khác).
 */
/** withMeta = false: bỏ dòng Kênh bán / Bảng giá (chi tiết hóa đơn tự hiển thị, cho sửa kênh bán). */
export function InvoiceShipmentInfo({ inv, withMeta = true }: { inv: Invoice; withMeta?: boolean }) {
  const t = useT(deliveryNs);
  const { can } = useCurrentUser();
  const [creating, setCreating] = useState(false);
  const s = inv.shipment;
  const notShipped = inv.status === "COMPLETED" && inv.saleMode === "DELIVERY" && (!s || s.status === "CANCELLED");
  const cell = "flex min-h-[26px] items-center gap-2";
  return (
    <div className="space-y-2 text-xs">
      {withMeta && <div className="grid grid-cols-1 gap-x-8 md:grid-cols-3">
        <div className={cell}><span className="w-20 shrink-0">{t("fields.salesChannel")}:</span>{inv.salesChannelName ?? t("invoiceInfo.directSale")}</div>
        <div className={cell}><span className="w-20 shrink-0">{t("fields.priceBook")}:</span>{inv.priceBookName ?? t("invoiceInfo.defaultPriceBook")}</div>
      </div>}
      {notShipped && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-dashed border-amber-400 bg-amber-50 px-3 py-2 text-[13px]">
          <Truck className="size-4 text-amber-600" /><b>{t("invoiceInfo.notShipped")}</b>
          <span className="text-muted-foreground">{t(s ? "invoiceInfo.dueAfterCancel" : "invoiceInfo.due",
            { code: s?.code ?? "", amount: formatMoney(Math.max(0, Number(inv.total) - Number(inv.paid))) })}</span>
          {can("sales.perform") && (
            <Button size="sm" className="ml-auto h-7" onClick={() => setCreating(true)}><Plus className="size-4" /> {t("invoiceInfo.createShipment")}</Button>)}
        </div>)}
      {s && s.status !== "CANCELLED" && (
        <div className="rounded-md border border-dashed border-primary/40 bg-primary/5 px-3 py-2">
          <div className="mb-1 flex flex-wrap items-center gap-3 text-[13px]">
            <Truck className="size-4 text-primary" /><b>{renderRichText(t("invoiceInfo.shipment"), { code: <DocCodeLink code={s.code} kind="/delivery/shipments" /> })}</b>
            <StatusBadge tone={SHIPMENT_TONE[s.status]}>{t(SHIPMENT_STATUS_KEY[s.status])}</StatusBadge>
            {s.returnCode && <StatusBadge tone="red">{renderRichText(t("invoiceInfo.returnDoc"),
              { code: <DocCodeLink code={s.returnCode} kind="/returns" /> })}</StatusBadge>}
            <Link href="/delivery" className="ml-auto text-primary hover:underline">{t("invoiceInfo.manage")}</Link>
          </div>
          <div className="grid grid-cols-1 gap-x-8 md:grid-cols-3">
            <div className={cell}><span className="w-24 shrink-0">{t("fields.receiver")}:</span>{s.receiverName} - {s.receiverPhone}</div>
            <div className={`${cell} md:col-span-2`}><span className="w-24 shrink-0">{t("fields.address")}:</span>{s.receiverAddress}{s.area ? ` (${s.area})` : ""}</div>
            <div className={cell}><span className="w-24 shrink-0">{t("fields.partnerShort")}:</span>{s.partnerName}</div>
            <div className={cell}><span className="w-24 shrink-0">{t("fields.fee")}:</span>
              {formatMoney(s.shippingFee)} ({t(FEE_PAYER_KEY[s.feePayer])})</div>
            <div className={cell}><span className="w-24 shrink-0">{t("fields.cod")}:</span><b className="text-primary">{formatMoney(s.codAmount)}</b></div>
            {s.weightGram ? <div className={cell}><span className="w-24 shrink-0">{t("fields.weight")}:</span>{formatNumber(s.weightGram)} g</div> : null}
            {s.deliveredAt && <div className={cell}><span className="w-24 shrink-0">{t("fields.completed")}:</span>{formatDateTime(s.deliveredAt)}</div>}
            {s.note && <div className={`${cell} md:col-span-3`}><span className="w-24 shrink-0">{t("fields.note")}:</span>{s.note}</div>}
          </div>
        </div>)}
      {creating && <ShipmentCreateDialog inv={inv} onClose={() => setCreating(false)} />}
    </div>
  );
}
