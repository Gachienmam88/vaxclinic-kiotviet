"use client";

import { useQueries } from "@tanstack/react-query";
import { sameCode } from "@/components/ui/deep-link-route";
import { api } from "@/lib/api-client";
import type { SettlementRow } from "./delivery-types";

/**
 * Link sâu phiếu đối soát / thanh toán ĐTGH (?code=DS…): không có API tra theo mã → tải lịch sử thanh toán của các đối tác
 * đang hiển thị (cùng query key với tab "Lịch sử thanh toán", dùng lại cache) và trả id đối tác sở hữu phiếu.
 */
export function useSettlementOwner(code: string | null, partnerIds: string[]): string | null {
  const enabled = !!code && /^DS\d/i.test(code);
  const results = useQueries({
    queries: (enabled ? partnerIds : []).map((id) => ({
      queryKey: ["delivery-settlements", id],
      queryFn: () => api<SettlementRow[]>(`/delivery-partners/${id}/settlements`),
    })),
  });
  if (!enabled) return null;
  const i = results.findIndex((r) => r.data?.some((s) => sameCode(s.code, code)));
  return i < 0 ? null : partnerIds[i];
}
