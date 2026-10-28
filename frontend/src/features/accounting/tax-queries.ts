"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api-client";

export type TaxLocation = {
  code: string; name: string; address: string | null; province: string | null; ward: string | null;
  branchIds: string[]; startDate: string | null; active: boolean;
};
export type TaxProfile = {
  taxCode: string; name: string | null; revenueGroup: number; pitMethod: "REVENUE" | "PROFIT"; active: boolean; locations: TaxLocation[];
};
export type TaxSettings = {
  vatEnabled: boolean; sector: string; vatRate: number; pitRate: number; defaultTaxCode: string | null; profiles: TaxProfile[];
};

export const useTaxSettings = () => useQuery({ queryKey: ["tax-settings"], queryFn: () => api<TaxSettings>("/settings/tax") });

export function useSaveTax() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TaxSettings) => api<TaxSettings>("/settings/tax", { method: "PUT", body }),
    onSuccess: (d) => { qc.setQueryData(["tax-settings"], d); toast.success("Thiết lập đã được cập nhật thành công"); },
    onError: (e) => toast.error(errorMessage(e)),
  });
}

/** Chi nhánh thuộc các địa điểm kinh doanh đang hoạt động của 1 MST (sổ kế toán lấy số liệu theo các chi nhánh này). */
export const profileBranches = (p: TaxProfile) =>
  [...new Set(p.locations.filter((l) => l.active).flatMap((l) => l.branchIds))];
