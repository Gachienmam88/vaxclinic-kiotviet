"use client";

import { Pill } from "lucide-react";
import { useT } from "@/lib/i18n";
import { salesNs } from "@/messages/sales";
import type { Invoice } from "./sales-types";

/** Chi tiết hóa đơn "Bán thuốc theo đơn": mã đơn thuốc, bác sĩ kê đơn, cơ sở khám, chẩn đoán (không có thì không hiện). */
export function InvoicePrescriptionInfo({ inv }: { inv: Invoice }) {
  const t = useT(salesNs);
  const p = inv.prescription;
  if (!p) return null;
  const item = (label: string, v: string | null) => (
    <div className="flex min-h-[26px] items-center gap-2"><span className="w-28 shrink-0 text-muted-foreground">{label}</span>{v || "—"}</div>);
  return (
    <div className="rounded-md border border-[#e5e7eb] bg-[#f8f9fa] px-4 py-2.5 text-xs">
      <p className="mb-1 flex items-center gap-2 text-[13px] font-semibold"><Pill className="size-4 text-[#4b5563]" />{t("invoices.prescription.title")}</p>
      <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
        {item(t("invoices.prescription.code"), p.code)}{item(t("invoices.prescription.doctor"), p.doctor)}
        {item(t("invoices.prescription.facility"), p.facility)}{item(t("invoices.prescription.diagnosis"), p.diagnosis)}
      </div>
    </div>
  );
}
