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
};

export type Me = { user: User; permissions: string[] };

/** Logged-in user + permissions (drives menu visibility; backend still enforces). */
export function useCurrentUser() {
  const query = useQuery({ queryKey: ["me"], queryFn: () => api<Me>("/auth/me"), staleTime: 5 * 60_000 });
  const can = (perm: string) => query.data?.permissions.includes(perm) ?? false;
  return { ...query, can };
}
