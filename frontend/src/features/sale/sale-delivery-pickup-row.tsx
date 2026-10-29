"use client";

import { useBranches } from "@/features/settings/settings-queries";
import { useT } from "@/lib/i18n";
import { saleNs } from "@/messages/sale";

/**
 * Địa chỉ lấy hàng (chỉ ở tab cổng giao hàng): chấm tròn xanh + địa chỉ / SĐT chi nhánh đang bán, nối nét chấm xuống người nhận.
 * Chi nhánh chưa có địa chỉ → nhắc đỏ "Vui lòng thêm địa chỉ lấy hàng mới" (thêm ở Thiết lập → Chi nhánh).
 */
export function SaleDeliveryPickupRow({ branchId }: { branchId: string }) {
  const t = useT(saleNs);
  const { data: branches = [] } = useBranches();
  const b = branches.find((x) => x.id === branchId);
  const text = [b?.address, b?.phone].filter(Boolean).join(" - ");
  return (
    <div className="relative pb-3">
      <div className="flex items-center gap-2.5">
        <span className="grid size-[18px] shrink-0 place-items-center rounded-full border-[5px] border-[#2171bc] bg-white" aria-hidden />
        <span className="flex h-8 min-w-0 flex-1 items-center truncate border-b border-[#1f2329]" title={text}>
          {text || <span className="text-[#9ca3af]">{t("delivery.pickup")}</span>}</span>
      </div>
      {!b?.address && <p className="mt-1 pl-7 text-[11px] text-destructive">{t("delivery.pickupHint")}</p>}
      <span className="absolute top-7 bottom-0 left-[8px] border-l border-dotted border-[#9ca3af]" aria-hidden />
    </div>
  );
}
