"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api-client";
import { useT } from "@/lib/i18n";
import { accountingNs } from "@/messages/accounting";

export type TaxLocation = {
  code: string; name: string; address: string | null; province: string | null; ward: string | null;
  branchIds: string[]; startDate: string | null; active: boolean;
  provinceCode?: string | null; wardCode?: string | null;
};
export type TaxProfile = {
  taxCode: string; name: string | null; revenueGroup: number; pitMethod: "REVENUE" | "PROFIT"; active: boolean; locations: TaxLocation[];
};
export type Sector = { code: string; name: string; vatRate: number; pitRate: number };
/** categorySectors: id nhóm hàng → mã ngành (nhóm con chưa gắn thì theo nhóm cha, không có thì ngành mặc định). */
export type TaxSettings = {
  vatEnabled: boolean; sectors: Sector[]; defaultSector: string; categorySectors: Record<string, string>;
  defaultTaxCode: string | null; profiles: TaxProfile[];
  /** Phương pháp tính thuế GTGT: DEDUCTION (khấu trừ, mặc định) / DIRECT (trực tiếp trên doanh thu). */
  vatMethod?: "DEDUCTION" | "DIRECT";
};

export const useTaxSettings = () => useQuery({ queryKey: ["tax-settings"], queryFn: () => api<TaxSettings>("/settings/tax") });

export function useSaveTax() {
  const qc = useQueryClient();
  const t = useT(accountingNs);
  return useMutation({
    mutationFn: (body: TaxSettings) => api<TaxSettings>("/settings/tax", { method: "PUT", body }),
    onSuccess: (d) => { qc.setQueryData(["tax-settings"], d); toast.success(t("profile.saved")); },
    onError: (e) => toast.error(errorMessage(e)),
  });
}

/** Chi nhánh thuộc các địa điểm kinh doanh đang hoạt động của 1 MST (sổ kế toán lấy số liệu theo các chi nhánh này). */
export const profileBranches = (p: TaxProfile) =>
  [...new Set(p.locations.filter((l) => l.active).flatMap((l) => l.branchIds))];
