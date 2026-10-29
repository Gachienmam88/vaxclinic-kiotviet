"use client";

import { SaleChannelPicker } from "./sale-channel-picker";
import { customerPatch } from "./sale-checkout-panel";
import { SaleCustomerPicker } from "./sale-customer-picker";
import { deliveryOf, deliverySetter } from "./sale-delivery-draft";
import { SaleDeliveryPackageFields } from "./sale-delivery-package-fields";
import { SaleDeliveryPaySummary } from "./sale-delivery-pay-summary";
import { SaleDeliveryPickupRow } from "./sale-delivery-pickup-row";
import { SaleDeliveryReceiverFields } from "./sale-delivery-receiver-fields";
import { SaleSellerPicker } from "./sale-seller-picker";
import { SaleDateTime } from "./sale-ui-parts";
import type { DraftInvoice } from "./sale-types";
import type { SaleLookups } from "./use-sale-lookups";

/**
 * Cột giữa của Bán giao hàng (KiotViet): người bán · kênh bán · ngày giờ; khách hàng (F4); [địa chỉ lấy hàng — tab cổng];
 * người nhận + địa chỉ; kiện hàng; ghi chú cho bưu tá; Khách thanh toán + Thu hộ tiền (COD).
 */
export function SaleDeliveryInfoPanel({ draft, update, lookups, branchId, portal }: {
  draft: DraftInvoice; update: (p: Partial<DraftInvoice>) => void; lookups: SaleLookups; branchId: string; portal: boolean;
}) {
  const v = deliveryOf(draft);
  const set = deliverySetter(draft, update);
  return (
    <div className="flex w-[376px] shrink-0 flex-col rounded-lg bg-background px-4 pt-2.5 pb-3 text-[13px]">
      <div className="flex h-8 items-center gap-2">
        <SaleSellerPicker value={draft.sellerId} onChange={(sellerId) => update({ sellerId })} />
        <SaleChannelPicker value={draft.salesChannel ?? "DIRECT"} lookups={lookups} onChange={(salesChannel) => update({ salesChannel })} />
        <span className="ml-auto"><SaleDateTime /></span>
      </div>
      <div className="mt-2">
        <SaleCustomerPicker value={draft.customer} branchId={branchId} nameClassName="text-[#2171bc]"
          onChange={(c) => update(customerPatch(c, draft))} />
      </div>
      <div className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto border-t border-dashed border-[#d6d9de] pt-3 pr-1">
        {portal && <SaleDeliveryPickupRow branchId={branchId} />}
        <SaleDeliveryReceiverFields id={draft.id} v={v} set={set} customer={draft.customer} />
        <SaleDeliveryPackageFields v={v} set={set} />
      </div>
      <SaleDeliveryPaySummary draft={draft} update={update} />
    </div>
  );
}
