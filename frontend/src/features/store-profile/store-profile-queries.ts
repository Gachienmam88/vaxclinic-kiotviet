"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, errorMessage, type PageResponse } from "@/lib/api-client";

/** Khớp identity-service StoreProfileModels / integration-service storeprofile (Hồ sơ cửa hàng). */
export type BusinessType = "PERSONAL" | "HOUSEHOLD" | "ENTERPRISE";
export type StoreStatus = { paused: boolean; reopenOn: string | null; pauseUsed: boolean; sessionsNotBefore: number };
export type UserRef = { id: string; username: string; fullName: string };

export type StoreProfile = {
  businessType: BusinessType | null; birthDate: string | null; representative: string | null; idNumber: string | null;
  idIssueDate: string | null; idIssuePlace: string | null; gender: "MALE" | "FEMALE" | null; email: string | null;
  phone: string | null; address: string | null; province: string | null; ward: string | null;
  provinceCode: string | null; wardCode: string | null; storeName: string; accessCode: string; industry: string;
  branchCount: number; status: StoreStatus; owner: UserRef | null; isOwner: boolean; twoFactorEnabled: boolean;
};

export type VerifyPurpose = "PROFILE" | "PHONE" | "RENAME" | "TRANSFER" | "PAUSE";
export type HistoryItem = { id: number; occurredAt: string; userName: string | null; detail: string | null };

/** Nhãn hiển thị: t(`businessTypes.${v}`) / t(`genders.${v}`) trong namespace store-profile. */
export const BUSINESS_TYPES: readonly BusinessType[] = ["PERSONAL", "HOUSEHOLD", "ENTERPRISE"];
export const GENDERS = ["MALE", "FEMALE"] as const;

const KEY = ["store-profile"];

export const useStoreProfile = () => useQuery({ queryKey: KEY, queryFn: () => api<StoreProfile>("/store-profile") });

export const useStoreHistory = (page: number) => useQuery({
  queryKey: [...KEY, "history", page],
  queryFn: () => api<PageResponse<HistoryItem>>(`/store-profile/history?page=${page}&size=20`),
});

export const useTransferCandidates = (enabled: boolean) => useQuery({
  queryKey: [...KEY, "candidates"], enabled, queryFn: () => api<UserRef[]>("/store-profile/transfer-candidates"),
});

/** Trạng thái công khai (bảo lưu); dùng ở màn hình thông báo bảo lưu cho mọi user. */
export const useStoreStatus = () => useQuery({
  queryKey: ["store-status"], queryFn: () => api<StoreStatus>("/auth/store-status"), refetchInterval: 60_000,
});

/** Bước "Xác thực": mật khẩu (chưa bật 2FA) hoặc mã Authenticator → phiếu xác thực dùng 10 phút. */
export const verifyAction = (purpose: VerifyPurpose, password: string | null, code: string | null) =>
  api<{ verifyToken: string; expiresAt: string }>("/store-profile/verify", { method: "POST", body: { purpose, password, code } });

/** `success`: câu toast đã dịch. Ghi Hồ sơ cửa hàng rồi làm mới màn hình (hồ sơ, lịch sử, trạng thái bảo lưu, thông tin cửa hàng). */
export function useStoreProfileMutation<B>(method: string, path: string, success: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: B) => api<StoreProfile>(`/store-profile${path}`, { method, body }),
    onSuccess: () => {
      toast.success(success);
      void qc.invalidateQueries({ queryKey: KEY });
      void qc.invalidateQueries({ queryKey: ["store-status"] });
      void qc.invalidateQueries({ queryKey: ["shop-settings"] });
      void qc.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}
