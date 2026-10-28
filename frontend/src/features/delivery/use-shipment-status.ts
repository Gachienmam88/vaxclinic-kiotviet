"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api-client";
import { refreshDelivery } from "./delivery-queries";
import { shipmentStatusLabel, type ShipmentStatus, type StatusResult } from "./delivery-types";

/** Hỏi xác nhận các bước có hệ quả tiền / kho trước khi đổi trạng thái. */
export function confirmStatus(to: ShipmentStatus, count: number) {
  const what = count > 1 ? `${count} vận đơn` : "vận đơn";
  const extra: Partial<Record<ShipmentStatus, string>> = {
    DELIVERED: "Tiền thu hộ được ghi nhận khách đã trả, đối tác giao hàng nợ cửa hàng số tiền này.",
    RETURNING: "Hệ thống tạo phiếu trả hàng (hàng nhập lại kho) và hoàn tiền khách đã trả trước.",
    RETURNED: "Nếu chưa có phiếu trả hàng, hệ thống tạo phiếu trả hàng (hàng nhập lại kho).",
    CANCELLED: "Hóa đơn của vận đơn sẽ bị hủy, hàng nhập lại kho.",
  };
  return window.confirm(`Chuyển ${what} sang "${shipmentStatusLabel(to)}"?${extra[to] ? `\n${extra[to]}` : ""}`);
}

/** Đổi trạng thái 1 hoặc nhiều vận đơn; báo kết quả từng vận đơn lỗi. */
export function useShipmentStatus(onDone?: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, status, note }: { ids: string[]; status: ShipmentStatus; note?: string }) =>
      api<StatusResult[]>("/shipments/status", { method: "POST", body: { ids, status, note: note || null } }),
    onSuccess: (res, v) => {
      const ok = res.filter((r) => r.ok).length;
      const bad = res.filter((r) => !r.ok);
      if (ok) toast.success(`Đã chuyển ${ok} vận đơn sang "${shipmentStatusLabel(v.status)}"`);
      bad.forEach((r) => toast.error(r.message ?? `${r.code ?? "Vận đơn"}: không cập nhật được`));
      refreshDelivery(qc);
      onDone?.();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}
