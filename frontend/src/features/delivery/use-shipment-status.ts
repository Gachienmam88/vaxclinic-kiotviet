"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api-client";
import { refreshDelivery } from "./delivery-queries";
import { shipmentStatusLabel, type ShipmentStatus, type StatusResult } from "./delivery-types";

/** Tham số "Đã chuyển hoàn": cách hoàn tiền khách đã trả + phí cửa hàng chịu (chỉ khi 1 vận đơn). */
export type ReturnedOptions = {
  refundMethod: "CASH" | "TRANSFER" | "CREDIT"; bankAccountId: string | null; shippingFee?: number; returnFee?: number;
};

/** Hỏi xác nhận các bước có hệ quả tiền / kho trước khi đổi trạng thái (Đã chuyển hoàn dùng hộp thoại riêng). */
export function confirmStatus(to: ShipmentStatus, count: number) {
  const what = count > 1 ? `${count} vận đơn` : "vận đơn";
  const extra: Partial<Record<ShipmentStatus, string>> = {
    DELIVERED: "Tiền thu hộ được ghi nhận khách đã trả, đối tác giao hàng nợ cửa hàng số tiền này.",
    RETURNING: "Đối tác đang chuyển hàng về, chưa nhập kho. Khi cửa hàng nhận lại hàng, chọn \"Đã chuyển hoàn\".",
    CANCELLED: "Chỉ hủy vận đơn, hóa đơn giữ nguyên (khách còn nợ phần chưa trả); tạo vận đơn mới ở chi tiết hóa đơn. Muốn hủy bán thì hủy hóa đơn.",
  };
  return window.confirm(`Chuyển ${what} sang "${shipmentStatusLabel(to)}"?${extra[to] ? `\n${extra[to]}` : ""}`);
}

/** Đổi trạng thái 1 hoặc nhiều vận đơn; báo kết quả từng vận đơn lỗi. */
export function useShipmentStatus(onDone?: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, status, note, opts }: { ids: string[]; status: ShipmentStatus; note?: string; opts?: ReturnedOptions }) =>
      api<StatusResult[]>("/shipments/status", { method: "POST", body: { ids, status, note: note || null, ...opts } }),
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
