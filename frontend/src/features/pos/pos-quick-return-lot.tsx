"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { formatDate, formatNumber } from "@/lib/format";

type Lot = { id: string; branchId: string; lotNumber: string; expiryDate: string; quantity: number };

/** Trả nhanh, hàng quản lý theo lô: chọn lô nhập lại (lô của điểm tiêm, kể cả lô đã bán hết). Cần mạng. */
export function PosQuickReturnLot({ productId, branchId, value, onChange }: {
  productId: string; branchId: string; value: string | null | undefined; onChange: (lot: string) => void;
}) {
  const { data = [], isError } = useQuery({
    queryKey: ["product-lots", productId], queryFn: () => api<Lot[]>(`/products/${productId}/lots`), staleTime: 60_000,
  });
  const lots = data.filter((l) => l.branchId === branchId);
  return (
    <label className="mt-0.5 flex items-center gap-1.5 text-xs text-[#6b7280]" onClick={(e) => e.stopPropagation()}>
      Lô:
      <select aria-label="Lô hàng trả" value={value ?? ""} onChange={(e) => onChange(e.target.value)}
        className={`h-6 max-w-56 rounded border bg-background px-1 text-xs outline-none ${value ? "border-[#d6d9de]" : "border-destructive"}`}>
        <option value="">{isError ? "Mất mạng: chưa tải được lô" : "-- Chọn lô --"}</option>
        {lots.map((l) => <option key={l.id} value={l.lotNumber}>{l.lotNumber} · HSD {formatDate(l.expiryDate)} · tồn {formatNumber(l.quantity)}</option>)}
      </select>
    </label>
  );
}
