"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export type BranchRef = { id: string; code: string; name: string };

export type User = {
  id: string;
  username: string;
  fullName: string;
  phone: string | null;
  active: boolean;
  roleId: string;
  roleCode: string;
  roleName: string;
  branches: BranchRef[];
  /** Đã bật xác thực 2 lớp (danh sách người dùng). */
  twoFactorEnabled?: boolean;
  /** Chủ gian hàng. */
  owner?: boolean;
};

/** twoFactorEnabled: đã bật xác thực 2 lớp; storeOwner: là chủ gian hàng (Hồ sơ cửa hàng). */
export type Me = { user: User; permissions: string[]; twoFactorEnabled?: boolean; storeOwner?: boolean };

/** Logged-in user + permissions (drives menu visibility; backend still enforces). */
export function useCurrentUser() {
  const query = useQuery({ queryKey: ["me"], queryFn: () => api<Me>("/auth/me"), staleTime: 5 * 60_000 });
  const can = (perm: string) => query.data?.permissions.includes(perm) ?? false;
  return { ...query, can };
}
