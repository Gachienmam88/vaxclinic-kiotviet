"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { NumberInput } from "@/components/number-input";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { usePartner } from "@/features/delivery/delivery-queries";
import { INITIAL_SHIPMENT_STATUSES, SERVICE_TYPES, SHIPMENT_STATUS_KEY } from "@/features/delivery/delivery-types";
import { PartnerFormDialog } from "@/features/delivery/partner-form-dialog";
import { useT } from "@/lib/i18n";
import { deliveryNs } from "@/messages/delivery";
import { saleNs } from "@/messages/sale";
import { deliveryOf, deliverySetter, lineField } from "./sale-delivery-draft";
import type { DeliveryDraft, DraftInvoice } from "./sale-types";
import type { SaleLookups } from "./use-sale-lookups";

const SELECT = `${lineField} cursor-pointer`;

/** Dòng nhãn trái + ô gạch chân phải của tab Tự giao hàng. */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-10 items-center gap-3">
      <span className="w-[120px] shrink-0">{label}</span>
      <div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>
    </div>
  );
}

/**
 * Tab "Tự giao hàng" (KiotViet): Đối tác giao hàng (chọn + sửa ✎ + thêm +); chọn đối tác rồi mới hiện Loại dịch vụ,
 * Phí áp dụng, Mã vận đơn, Thời gian giao hàng, Trạng thái giao hàng (mặc định Chờ xử lý).
 */
export function SaleDeliverySelfTab({ draft, update, lookups }: {
  draft: DraftInvoice; update: (p: Partial<DraftInvoice>) => void; lookups: SaleLookups;
}) {
  const t = useT(saleNs);
  const td = useT(deliveryNs);
  const v = deliveryOf(draft);
  const set = deliverySetter(draft, update);
  const [dialog, setDialog] = useState<"new" | "edit" | null>(null);
  const { data: editing } = usePartner(dialog === "edit" ? v.partnerId : null);
  const online = () => (navigator.onLine ? true : (toast.error(t("delivery.partnerOffline")), false));

  return (
    <div className="space-y-1 px-1 text-[13px]">
      <Row label={t("delivery.partner")}>
        <select className={`${SELECT} ${v.partnerId ? "" : "text-[#9ca3af]"}`} aria-label={t("delivery.partner")} value={v.partnerId}
          onChange={(e) => set({ partnerId: e.target.value })}>
          <option value="">{t("delivery.pickPartner")}</option>
          {lookups.partners.map((p) => <option key={p.id} value={p.id} className="text-foreground">{p.name}</option>)}
        </select>
        {v.partnerId && <button type="button" className="text-[#4b5563] hover:text-primary" aria-label={t("delivery.editPartner")}
          title={t("delivery.editPartner")} onClick={() => online() && setDialog("edit")}><Pencil className="size-4" /></button>}
        <button type="button" className="text-[#4b5563] hover:text-primary" aria-label={t("delivery.addPartner")} title={t("delivery.addPartner")}
          onClick={() => online() && setDialog("new")}><Plus className="size-4" /></button>
      </Row>
      {v.partnerId && <>
        <Row label={t("delivery.serviceType")}>
          <select className={SELECT} aria-label={t("delivery.serviceType")} value={v.serviceType ?? "STANDARD"}
            onChange={(e) => set({ serviceType: e.target.value as DeliveryDraft["serviceType"] })}>
            {SERVICE_TYPES.map((s) => <option key={s} value={s}>{t(`delivery.services.${s}`)}</option>)}
          </select>
        </Row>
        <Row label={t("delivery.fee")}>
          <NumberInput aria-label={t("delivery.fee")} className={lineField} value={v.shippingFee} onValueChange={(shippingFee) => set({ shippingFee })} />
        </Row>
        <Row label={t("delivery.waybill")}>
          <input className={lineField} aria-label={t("delivery.waybill")} maxLength={50} value={v.waybillCode ?? ""}
            onChange={(e) => set({ waybillCode: e.target.value })} />
        </Row>
        <Row label={t("delivery.deliveryTime")}>
          <DateTimePicker aria-label={t("delivery.deliveryTime")} className={lineField} placeholder="" value={v.expectedDeliveryAt ?? ""}
            onChange={(expectedDeliveryAt) => set({ expectedDeliveryAt })} />
        </Row>
        <Row label={t("delivery.status")}>
          <select className={SELECT} aria-label={t("delivery.status")} value={v.status ?? "PENDING"} disabled={!!draft.editOf}
            onChange={(e) => set({ status: e.target.value as DeliveryDraft["status"] })}>
            {INITIAL_SHIPMENT_STATUSES.map((s) => <option key={s} value={s}>{td(SHIPMENT_STATUS_KEY[s])}</option>)}
          </select>
        </Row>
      </>}
      {dialog === "new" && <PartnerFormDialog onClose={() => setDialog(null)}
        onSaved={(p) => { lookups.upsertPartner(p); set({ partnerId: p.id }); }} />}
      {dialog === "edit" && editing && <PartnerFormDialog partner={editing} onClose={() => setDialog(null)} onSaved={lookups.upsertPartner} />}
    </div>
  );
}
