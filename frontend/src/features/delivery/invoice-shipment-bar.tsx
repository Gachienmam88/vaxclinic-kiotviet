"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ShoppingBasket } from "lucide-react";
import { DocCodeLink } from "@/components/ui/doc-code-link";
import { StatusBadge } from "@/features/sales/invoice-list-kit";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { renderRichText } from "@/lib/i18n/render-rich-text";
import { joinAddress } from "@/lib/vn-admin-search";
import { deliveryNs } from "@/messages/delivery";
import { FEE_PAYER_KEY, SHIPMENT_STATUS_KEY, SHIPMENT_TONE, type ShipmentInfo } from "./delivery-types";

/**
 * Thanh gập "🧺 Tự giao đến <địa chỉ>" ở chi tiết hóa đơn (KiotViet); mở ra: đối tác, loại dịch vụ, phí, mã vận đơn, thời gian
 * giao, trạng thái giao hàng, người nhận, thu hộ, kiện hàng, ghi chú, mã vận đơn nội bộ (link) + Quản lý giao hàng.
 */
export function InvoiceShipmentBar({ s }: { s: ShipmentInfo }) {
  const t = useT(deliveryNs);
  const [open, setOpen] = useState(false);
  const cell = "flex min-h-[26px] items-center gap-2";
  const item = (label: string, value: React.ReactNode, wide = false) => (
    <div className={`${cell} ${wide ? "md:col-span-3" : ""}`}><span className="w-32 shrink-0 text-muted-foreground">{label}</span>{value}</div>);
  const dims = [s.lengthCm, s.widthCm, s.heightCm].every((x) => x != null) ? ` · ${s.lengthCm}×${s.widthCm}×${s.heightCm} cm` : "";

  return (
    <div className="rounded-md border border-[#e5e7eb] bg-[#f8f9fa] text-[13px]">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex h-11 w-full items-center gap-2 px-4 text-left">
        <ShoppingBasket className="size-4 text-[#4b5563]" />
        <span className="min-w-0 flex-1 truncate">{t("selfShip.selfDeliverTo")} <b>{joinAddress(s.receiverAddress, s.area)}</b></span>
        <ChevronDown className={`size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-[#e5e7eb] px-4 py-3 text-xs">
          <div className="mb-2 flex flex-wrap items-center gap-3 text-[13px]">
            <b>{renderRichText(t("invoiceInfo.shipment"), { code: <DocCodeLink code={s.code} kind="/delivery/shipments" /> })}</b>
            <StatusBadge tone={SHIPMENT_TONE[s.status]}>{t(SHIPMENT_STATUS_KEY[s.status])}</StatusBadge>
            {s.returnCode && <StatusBadge tone="red">{renderRichText(t("invoiceInfo.returnDoc"),
              { code: <DocCodeLink code={s.returnCode} kind="/returns" /> })}</StatusBadge>}
            <Link href="/delivery" className="ml-auto text-primary hover:underline">{t("invoiceInfo.manage")}</Link>
          </div>
          <div className="grid grid-cols-1 gap-x-8 md:grid-cols-3">
            {item(t("fields.partnerShort"), s.partnerName)}
            {item(t("selfShip.serviceType"), t(`selfShip.serviceTypes.${s.serviceType ?? "STANDARD"}`))}
            {item(t("fields.fee"), `${formatMoney(s.shippingFee)} (${t(FEE_PAYER_KEY[s.feePayer])})`)}
            {item(t("selfShip.waybill"), s.waybillCode || "—")}
            {item(t("selfShip.deliveryTime"), s.expectedDeliveryAt ? formatDateTime(s.expectedDeliveryAt) : "—")}
            {item(t("selfShip.deliveryStatus"), t(SHIPMENT_STATUS_KEY[s.status]))}
            {item(t("fields.receiver"), `${s.receiverName} - ${s.receiverPhone}`)}
            {item(t("fields.cod"), <b className="text-primary">{s.codEnabled === false ? t("selfShip.codOff") : formatMoney(s.codAmount)}</b>)}
            {item(t("selfShip.package"), `${t("selfShip.packages", { count: s.packageCount ?? 1 })}${s.weightGram ? ` · ${formatNumber(s.weightGram)} g` : ""}${dims}`)}
            {s.deliveredAt && item(t("fields.completed"), formatDateTime(s.deliveredAt))}
            {s.note && item(t("selfShip.postmanNote"), s.note, true)}
          </div>
        </div>)}
    </div>
  );
}
