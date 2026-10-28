"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api-client";
import { useT } from "@/lib/i18n";
import { settingsNs } from "@/messages/settings";

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
  /** Khu vực theo ĐVHC 2 cấp (tên + mã); null với chi nhánh cũ. */
  province?: string | null; ward?: string | null; provinceCode?: string | null; wardCode?: string | null;
};

export type StoreInfo = {
  name: string; phone: string | null; email: string | null; address: string | null;
  province: string | null; ward: string | null; taxCode: string | null; logo: string | null;
  /** Mã ĐVHC 2 cấp (tỉnh 2 số, phường/xã 5 số). */
  provinceCode?: string | null; wardCode?: string | null;
  /** Địa chỉ truy cập cửa hàng (bước 1 đăng nhập); null = tự sinh từ tên cửa hàng. */
  accessCode: string | null;
};

export type SalesSettings = {
  allowNegativeStock: boolean; blockEditPublishedEInvoice: boolean; lockTransactionTime: boolean;
  returnLimitDays: number | null;
};

/** Trường khách hàng có thể đặt bắt buộc — khớp SettingsController.CUSTOMER_FIELDS (identity-service).
 * Nhãn: settings.json customers.fields.<khóa>. */
export const CUSTOMER_FIELDS = ["phone", "birthday", "email", "address", "gender", "facebook", "group"] as const;

export type CustomerSettings = { requiredFields: string[]; debtLimit: number | null };

/** Khóa sổ: branches = { branchId: "yyyy-MM-dd" }. */
export type LockSettings = { enabled: boolean; branches: Record<string, string> };

export type ShopSettings = {
  store: StoreInfo | null; sales: SalesSettings; customer: CustomerSettings; lock: LockSettings;
  /** Địa chỉ truy cập đang có hiệu lực. */
  accessCode: string;
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
  const t = useT(settingsNs);
  return useMutation({
    mutationFn: (body: T) => api<ShopSettings>(`/settings/${group}`, { method: "PUT", body }),
    onSuccess: (data) => { qc.setQueryData(["shop-settings"], data); toast.success(t("common.updated")); },
    onError: (e) => toast.error(errorMessage(e)),
  });
}
