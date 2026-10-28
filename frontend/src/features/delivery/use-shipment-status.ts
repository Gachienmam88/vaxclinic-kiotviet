"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api-client";
import { useT, type TFunction } from "@/lib/i18n";
import { deliveryNs } from "@/messages/delivery";
import { refreshDelivery } from "./delivery-queries";
import { SHIPMENT_STATUS_KEY, type ShipmentStatus, type StatusResult } from "./delivery-types";

type DeliveryT = TFunction<typeof deliveryNs.vi>;

/** Tham số "Đã chuyển hoàn": cách hoàn tiền khách đã trả + phí cửa hàng chịu (chỉ khi 1 vận đơn). */
export type ReturnedOptions = {
  refundMethod: "CASH" | "TRANSFER" | "CREDIT"; bankAccountId: string | null; shippingFee?: number; returnFee?: number;
};

/** Hỏi xác nhận các bước có hệ quả tiền / kho trước khi đổi trạng thái (Đã chuyển hoàn dùng hộp thoại riêng). */
export function confirmStatus(t: DeliveryT, to: ShipmentStatus, count: number) {
  const status = t(SHIPMENT_STATUS_KEY[to]);
  const question = count > 1 ? t("confirmStatus.many", { count, status }) : t("confirmStatus.one", { status });
  const extra = to === "DELIVERED" || to === "RETURNING" || to === "CANCELLED" ? t(`confirmStatus.${to}`) : "";
  return window.confirm(extra ? `${question}\n${extra}` : question);
}

/** Đổi trạng thái 1 hoặc nhiều vận đơn; báo kết quả từng vận đơn lỗi. */
export function useShipmentStatus(onDone?: () => void) {
  const t = useT(deliveryNs);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, status, note, opts }: { ids: string[]; status: ShipmentStatus; note?: string; opts?: ReturnedOptions }) =>
      api<StatusResult[]>("/shipments/status", { method: "POST", body: { ids, status, note: note || null, ...opts } }),
    onSuccess: (res, v) => {
      const ok = res.filter((r) => r.ok).length;
      const bad = res.filter((r) => !r.ok);
      if (ok) toast.success(t("confirmStatus.changed", { count: ok, status: t(SHIPMENT_STATUS_KEY[v.status]) }));
      bad.forEach((r) => toast.error(r.message ?? t("confirmStatus.failed", { code: r.code ?? t("confirmStatus.shipmentFallback") })));
      refreshDelivery(qc);
      onDone?.();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}
