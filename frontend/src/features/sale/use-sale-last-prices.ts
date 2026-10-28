"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

type LastPrice = { productId: string; unitId: string; price: number; soldAt: string; invoiceCode: string };

/**
 * Giá bán gần nhất cho khách đang chọn, theo từng hàng + đơn vị (Thiết lập → Giá tiền → "Giá bán gần nhất").
 * Mất mạng / chưa chọn khách → không có (dòng hàng không hiện giá gần nhất).
 */
export function useSaleLastPrices(customerId: string | null, productIds: string[], enabled: boolean) {
  const ids = [...new Set(productIds)].sort();
  const { data = [] } = useQuery({
    queryKey: ["sale-last-prices", customerId, ids.join(",")],
    queryFn: () => api<LastPrice[]>(`/invoices/last-prices?customerId=${customerId}&productIds=${ids.join(",")}`),
    enabled: enabled && !!customerId && ids.length > 0,
    staleTime: 60_000,
    retry: false,
  });
  return (productId: string, unitId: string) => {
    const hit = data.find((p) => p.productId === productId && p.unitId === unitId);
    return hit ? Number(hit.price) : null;
  };
}
