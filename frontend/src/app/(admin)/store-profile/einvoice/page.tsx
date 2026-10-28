"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useShopSettings } from "@/features/settings/settings-queries";
import {
  EINVOICE_SUMMARY_KEY, EInvoicePackageDialog, usePackageMutation, type EInvoiceSummary, type PackageUsage,
} from "@/features/store-profile/einvoice-package-dialog";
import { InfoField, ProfileCard } from "@/features/store-profile/store-profile-shell";
import { api, errorMessage } from "@/lib/api-client";
import { formatDate, formatMoney } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { storeProfileNs } from "@/messages/store-profile";

/** Màu nhãn trạng thái gói; chữ: t(`einvoice.statuses.${status}`). */
const STATUS_CLASS: Record<PackageUsage["status"], string> = {
  NOT_STARTED: "bg-muted text-muted-foreground",
  ACTIVE: "bg-primary/10 text-primary",
  EXPIRED: "bg-destructive/10 text-destructive",
};

/** Hồ sơ cửa hàng → Hóa đơn điện tử (ảnh 186): tài khoản MISA, tài nguyên hóa đơn, danh sách gói (nhập tay). */
export default function EInvoiceUsagePage() {
  const { data, error } = useQuery({ queryKey: EINVOICE_SUMMARY_KEY, queryFn: () => api<EInvoiceSummary>("/store-profile/einvoice") });
  const settings = useShopSettings();
  const t = useT(storeProfileNs);
  const del = usePackageMutation();
  const [editing, setEditing] = useState<PackageUsage | "new" | null>(null);
  if (error) return <ProfileCard className="p-5 text-[13px] text-destructive">{errorMessage(error)}</ProfileCard>;

  return (
    <div className="space-y-3">
      <ProfileCard>
        <div className="flex items-center gap-3 border-b border-border px-5 py-3">
          <h2 className="text-[15px] font-semibold">{t("einvoice.account", { account: data?.account || settings.data?.accessCode || "" })}</h2>
          {data && (data.configured
            ? <span className="flex items-center gap-1.5 text-[13px] text-primary"><span className="size-1.5 rounded-full bg-primary" />{t("einvoice.active")}</span>
            : <Link href="/settings/einvoice" className="flex items-center gap-1.5 text-[13px] text-orange-600 hover:underline">
                <span className="size-1.5 rounded-full bg-orange-500" />{t("einvoice.notConnected")}</Link>)}
          <Link href="/invoices?einvoice=PUBLISHED,ACCEPTED"
            className="ml-auto flex h-8 items-center rounded-md bg-primary px-3 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90">{t("einvoice.viewInvoices")}</Link>
        </div>
        <div className="grid grid-cols-5 gap-6 px-5 py-4">
          <InfoField className="border-0" label={t("einvoice.issuer")} value={data?.issuer} />
          <InfoField className="border-0" label={t("einvoice.totalQuantity")} value={formatMoney(data?.totalQuantity ?? 0)} />
          <InfoField className="border-0" label={t("einvoice.published")} value={formatMoney(data?.published ?? 0)} />
          <InfoField className="border-0" label={t("einvoice.remaining")} value={<span className="text-orange-500">{formatMoney(data?.remaining ?? 0)}</span>} />
          <InfoField className="border-0" label={t("einvoice.serviceExpiry")} value={formatDate(data?.serviceExpiry)} />
        </div>
      </ProfileCard>
      <ProfileCard>
        <div className="flex items-center border-b border-border px-5 py-3">
          <h2 className="text-[15px] font-semibold">{t("einvoice.packagesTitle")}</h2>
          <button type="button" onClick={() => setEditing("new")}
            className="ml-auto flex h-8 items-center gap-1 rounded-md border border-primary px-3 text-[13px] font-semibold text-primary hover:bg-primary/5">
            <Plus className="size-4" /> {t("einvoice.addPackage")}</button>
        </div>
        <div className="px-5 py-4">
          <table className="w-full text-[13px]">
            <thead className="bg-primary/10 text-xs font-semibold [&_th]:h-[34px] [&_th]:px-2.5">
              <tr><th className="text-left">{t("einvoice.cols.name")}</th><th className="text-right">{t("einvoice.cols.quantity")}</th>
                <th className="text-right">{t("einvoice.cols.used")}</th><th className="text-right">{t("einvoice.cols.remaining")}</th>
                <th className="pl-8 text-left">{t("einvoice.cols.start")}</th><th className="text-left">{t("einvoice.cols.end")}</th>
                <th className="text-left">{t("einvoice.cols.status")}</th><th className="w-16" /></tr>
            </thead>
            <tbody>
              {data?.packages.map((p) => (
                <tr key={p.id} className="border-b border-border [&_td]:h-[42px] [&_td]:px-2.5">
                  <td>{p.name}</td><td className="text-right">{formatMoney(p.quantity)}</td><td className="text-right">{formatMoney(p.used)}</td>
                  <td className="text-right">{formatMoney(p.remaining)}</td><td className="pl-8">{formatDate(p.startDate)}</td><td>{formatDate(p.endDate)}</td>
                  <td><span className={cn("rounded px-1.5 py-0.5 text-[11px]", STATUS_CLASS[p.status])}>{t(`einvoice.statuses.${p.status}`)}</span></td>
                  <td className="whitespace-nowrap text-right">
                    <button type="button" aria-label={t("einvoice.editPackage")} className="rounded p-1 hover:bg-muted" onClick={() => setEditing(p)}><Pencil className="size-3.5" /></button>
                    <button type="button" aria-label={t("einvoice.deletePackage")} className="rounded p-1 hover:bg-muted" disabled={del.isPending}
                      onClick={() => window.confirm(t("einvoice.confirmDelete", { name: p.name })) && del.mutate({ method: "DELETE", id: p.id })}><Trash2 className="size-3.5" /></button>
                  </td>
                </tr>
              ))}
              {data && !data.packages.length && <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">{t("einvoice.empty")}</td></tr>}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-muted-foreground">
            {t("einvoice.note")}
            {!!data?.unallocated && <> {t("einvoice.unallocated", { amount: formatMoney(data.unallocated) })}</>}
          </p>
        </div>
      </ProfileCard>
      {editing && <EInvoicePackageDialog pkg={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
