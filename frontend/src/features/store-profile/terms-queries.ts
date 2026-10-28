"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api-client";
import { TERMS_VERSION } from "./terms-of-use-content";

/** acceptedAt null = user chưa đồng ý phiên bản hiện hành (identity TermsController). */
export type TermsStatus = { version: string; effectiveDate: string; acceptedAt: string | null };

export const useTermsStatus = (enabled = true) =>
  useQuery({ queryKey: ["terms"], enabled, queryFn: () => api<TermsStatus>("/auth/terms"), staleTime: 10 * 60_000 });

export function useAcceptTerms() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<TermsStatus>("/auth/terms/accept", { method: "POST", body: { version: TERMS_VERSION } }),
    onSuccess: (s) => qc.setQueryData(["terms"], s),
    onError: (e) => toast.error(errorMessage(e)),
  });
}
