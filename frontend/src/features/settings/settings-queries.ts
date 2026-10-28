"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api-client";

export type Role = {
  id: string; code: string; name: string; description: string | null; system: boolean;
  permissions: string[]; usernames: string[];
};

export type Branch = {
  id: string;
  code: string;
  name: string;
  address: string | null;
  phone: string | null;
  active: boolean;
  userCount: number;
};

export type StoreInfo = {
  name: string; phone: string | null; email: string | null; address: string | null;
  province: string | null; ward: string | null; taxCode: string | null; logo: string | null;
};

export type SalesSettings = {
  allowNegativeStock: boolean; blockEditPublishedEInvoice: boolean; lockTransactionTime: boolean;
  returnLimitDays: number | null;
};

export type CustomerSettings = { requiredFields: string[]; debtLimit: number | null };

/** Khóa sổ: branches = { branchId: "yyyy-MM-dd" }. */
export type LockSettings = { enabled: boolean; branches: Record<string, string> };

export type ShopSettings = {
  store: StoreInfo | null; sales: SalesSettings; customer: CustomerSettings; lock: LockSettings;
};

export function useRoles() {
  return useQuery({ queryKey: ["roles"], queryFn: () => api<Role[]>("/roles") });
}

export function useBranches() {
  return useQuery({ queryKey: ["branches"], queryFn: () => api<Branch[]>("/branches") });
}

/** Thiết lập cửa hàng — màn bán hàng, form khách hàng, mẫu in đều đọc. */
export function useShopSettings() {
  return useQuery({ queryKey: ["shop-settings"], queryFn: () => api<ShopSettings>("/settings"), staleTime: 60_000 });
}

/** Lưu 1 nhóm thiết lập (store | sales | customer | lock); KiotViet lưu ngay khi gạt nút. */
export function useSaveSettings<T>(group: "store" | "sales" | "customer" | "lock") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: T) => api<ShopSettings>(`/settings/${group}`, { method: "PUT", body }),
    onSuccess: (data) => { qc.setQueryData(["shop-settings"], data); toast.success("Thiết lập đã được cập nhật thành công"); },
    onError: (e) => toast.error(errorMessage(e)),
  });
}
