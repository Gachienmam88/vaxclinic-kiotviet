"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Info } from "lucide-react";
import { DOC_CODE_LINK_CLASS, DocCodeLink, docCodeHref } from "@/components/ui/doc-code-link";
import { useBranches } from "@/features/settings/settings-queries";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { deliveryNs } from "@/messages/delivery";
import { areaFromServer } from "./delivery-address";
import { SHIPMENT_STATUS_KEY, type ShipmentDetail } from "./delivery-types";

const INPUT = "h-8 w-full rounded-md border bg-background px-2.5 text-[13px] text-foreground";

/** TL quy đổi (g) = Dài × Rộng × Cao (cm) / 6000 kg → × 1000 / 6000 = / 6 g. */
export const convertedGram = (l: number | null, w: number | null, h: number | null) =>
  l && w && h ? Math.round((l * w * h) / 6) : 0;

/**
 * Tab "Thông tin" của vận đơn như KiotViet: thẻ 2 cột Thông tin người nhận / Thông tin hóa đơn + hộp gập "Thông tin vận chuyển"
 * 3 cột (mã, trạng thái, thời gian, người tạo | kiện, trọng lượng, TL quy đổi, người giao, dịch vụ | thời gian giao, thu hộ, phí).
 */
export function ShipmentDetailInfo({ d }: { d: ShipmentDetail }) {
  const t = useT(deliveryNs);
  const { data: branches = [] } = useBranches();
  const [open, setOpen] = useState(true);
  const s = d.item;
  const area = areaFromServer(s);
  const row = (label: string, value: React.ReactNode, input = false) => (
    <div className={cn("grid min-h-9 grid-cols-[110px_1fr] items-center gap-3 py-1", !input && "border-b border-[#eff0f3]")}>
      <span className="text-muted-foreground">{label}:</span>{input ? <input className={INPUT} readOnly value={String(value ?? "")} /> : <span>{value}</span>}
    </div>);
  const cell = (label: React.ReactNode, value: React.ReactNode) => (
    <div className="grid min-h-8 grid-cols-[120px_1fr] items-center gap-2"><span className="text-muted-foreground">{label}:</span><span>{value}</span></div>);
  const tip = (label: string, text: string) => (
    <span className="inline-flex items-center gap-1">{label}<Info className="size-3.5" aria-label={text}><title>{text}</title></Info></span>);
  const dims = [d.lengthCm, d.widthCm, d.heightCm].every((x) => x != null) ? `${d.lengthCm} × ${d.widthCm} × ${d.heightCm} cm` : "—";
  const customer = s.customerCode
    ? <Link href={docCodeHref(s.customerCode, "/customers")!} className={DOC_CODE_LINK_CLASS}>{s.customerName}</Link> : s.customerName;

  return (
    <div className="space-y-4 p-4 text-[13px]">
      <div className="grid grid-cols-1 gap-x-12 lg:grid-cols-2">
        <div>
          <p className="mb-2 font-semibold">{t("kv.detail.receiverTitle")}</p>
          {row(t("kv.detail.receiver"), s.receiverName)}{row(t("kv.detail.phone"), s.receiverPhone)}
          {row(t("kv.detail.address"), s.receiverAddress)}{row(t("kv.detail.area"), area.provinceName || s.area, true)}
          {row(t("kv.detail.ward"), area.wardName, true)}
        </div>
        <div>
          <p className="mb-2 font-semibold">{t("kv.detail.invoiceTitle")}</p>
          {row(t("kv.detail.invoice"), <DocCodeLink code={s.invoiceCode} kind="/invoices" />)}
          {row(t("kv.detail.branch"), branches.find((b) => b.id === s.branchId)?.name)}
          {row(t("kv.detail.customer"), customer)}{row(t("kv.detail.qty"), formatNumber(d.itemQuantity))}
          {row(t("kv.detail.value"), formatMoney(d.invoiceTotal))}{row(t("kv.detail.note"), d.invoiceNote || d.note || "")}
        </div>
      </div>
      <div className="rounded-md border bg-[#f8f9fa]">
        <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex h-10 w-full items-center px-3 font-semibold">
          {t("kv.detail.transport")}<ChevronDown className={cn("ml-auto size-4 transition-transform", open && "rotate-180")} /></button>
        {open && (
          <div className="grid grid-cols-1 gap-x-8 px-3 pb-3 md:grid-cols-3">
            <div>{cell(t("kv.detail.waybill"), s.waybillCode || "")}{cell(t("kv.detail.status"), t(SHIPMENT_STATUS_KEY[s.status]))}
              {cell(t("kv.detail.createdAt"), formatDateTime(s.createdAt))}{cell(t("kv.detail.createdBy"), d.createdByName)}
              {cell(t("kv.detail.internalCode"), <DocCodeLink code={s.code} kind="/delivery/shipments" />)}</div>
            <div>{cell(t("kv.detail.packages"), t("kv.detail.packagesValue", { count: d.packageCount || 1 }))}
              {cell(t("kv.detail.weightSize"), `${d.weightGram ? formatNumber(d.weightGram) : 0} g | ${dims}`)}
              {cell(tip(t("kv.detail.converted"), t("kv.detail.convertedTip")), `${formatNumber(convertedGram(d.lengthCm, d.widthCm, d.heightCm))} g`)}
              {cell(t("kv.detail.courier"), s.partnerName)}
              {cell(t("kv.detail.service"), s.serviceType ? t(`selfShip.serviceTypes.${s.serviceType}`) : "")}</div>
            <div>{cell(t("kv.detail.deliveryTime"), s.expectedDeliveryAt ? formatDateTime(s.expectedDeliveryAt)
              : <span className="text-muted-foreground">{t("kv.common.none")}</span>)}
              {cell(t("kv.detail.cod"), <b>{formatMoney(s.codAmount)}</b>)}{cell(t("kv.detail.codOpen"), formatMoney(d.codOpen))}
              {cell(tip(t("kv.detail.partnerFee"), t("kv.detail.partnerFeeTip")), formatMoney(d.partnerFee))}
              {cell(t("kv.detail.partnerFeeOpen"), formatMoney(d.partnerFeeOpen))}</div>
          </div>)}
      </div>
    </div>
  );
}
