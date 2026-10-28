"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export type Role = { id: string; code: string; name: string; system: boolean; permissions: string[] };

export type Branch = {
  id: string;
  code: string;
  name: string;
  address: string | null;
  phone: string | null;
  active: boolean;
};

export function useRoles() {
  return useQuery({ queryKey: ["roles"], queryFn: () => api<Role[]>("/roles") });
}

export function useBranches() {
  return useQuery({ queryKey: ["branches"], queryFn: () => api<Branch[]>("/branches") });
}
