"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api-client";
import { useT } from "@/lib/i18n";
import { deliveryNs } from "@/messages/delivery";
import { usePartnerGroups } from "./delivery-queries";
import type { PartnerGroup } from "./delivery-types";

/** Ô "Nhóm đối tác": chọn nhóm có sẵn, hoặc "+" nhập tên → tạo nhóm mới (POST /delivery-partners/groups) và chọn luôn. */
export function PartnerGroupSelect({ value, onChange, className }: { value: string; onChange: (id: string) => void; className: string }) {
  const t = useT(deliveryNs);
  const qc = useQueryClient();
  const { data: groups = [] } = usePartnerGroups();
  const [adding, setAdding] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: (name: string) => api<PartnerGroup>("/delivery-partners/groups", { method: "POST", body: { name } }),
    onSuccess: (g) => { qc.invalidateQueries({ queryKey: ["delivery-partner-groups"] }); onChange(g.id); setAdding(null); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (adding != null) {
    const submit = () => adding.trim() && create.mutate(adding.trim());
    return (
      <div className="flex items-center gap-2">
        <input autoFocus className={className} maxLength={100} aria-label={t("partner.newGroup")} placeholder={t("partner.newGroup")} value={adding}
          onChange={(e) => setAdding(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } if (e.key === "Escape") setAdding(null); }} />
        <button type="button" aria-label={t("partner.addGroup")} disabled={create.isPending || !adding.trim()} onClick={submit}
          className="text-primary disabled:opacity-50"><Check className="size-4" /></button>
        <button type="button" aria-label={t("partner.cancelGroup")} onClick={() => setAdding(null)} className="text-[#6b7280]"><X className="size-4" /></button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <select className={`${className} ${value ? "" : "text-[#9ca3af]"}`} aria-label={t("partner.group")} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{t("partner.pickGroup")}</option>
        {groups.map((g) => <option key={g.id} value={g.id} className="text-foreground">{g.name}</option>)}
      </select>
      <button type="button" aria-label={t("partner.addGroup")} title={t("partner.addGroup")} onClick={() => setAdding("")}
        className="text-[#4b5563] hover:text-primary"><Plus className="size-4" /></button>
    </div>
  );
}
