"use client";

import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SETTINGS_TABS } from "@/features/settings/settings-shell";
import {
  CERTIFICATES_KEY, CertificateFormDialog, useCertificateMutation, type Certificate,
} from "@/features/store-profile/certificate-form-dialog";
import { InfoField, ProfileCard } from "@/features/store-profile/store-profile-shell";
import { api, errorMessage } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { commonNs } from "@/messages/common";
import { storeProfileNs } from "@/messages/store-profile";

function Pill({ tone, children }: { tone: "green" | "gray" | "red"; children: React.ReactNode }) {
  return <span className={cn("rounded px-1.5 py-0.5 text-[12px]", tone === "green" && "bg-green-100 text-green-700",
    tone === "gray" && "bg-muted text-muted-foreground", tone === "red" && "bg-destructive/10 text-destructive")}>{children}</span>;
}

const certTone = (s: Certificate["cert_status"]) => (s === "APPROVED" ? "green" : s === "REVOKED" ? "red" : "gray");

/** Chi tiết mở rộng (ảnh 187): tab Thông tin chung / Chứng thư số + Sửa / Xóa. */
function CertificateDetail({ c, onEdit }: { c: Certificate; onEdit: () => void }) {
  const del = useCertificateMutation();
  const t = useT(storeProfileNs);
  const tc = useT(commonNs);
  return (
    <Tabs defaultValue="general" className="gap-0">
      <TabsList variant="line" className={SETTINGS_TABS.list}>
        <TabsTrigger value="general" className={SETTINGS_TABS.trigger}>{t("certificates.tabs.general")}</TabsTrigger>
        <TabsTrigger value="cert" className={SETTINGS_TABS.trigger}>{t("certificates.tabs.cert")}</TabsTrigger>
      </TabsList>
      <TabsContent value="general" className="grid grid-cols-4 gap-x-6 gap-y-3 px-5 py-4">
        <InfoField label={t("certificates.fields.signatureType")} value={t(`certificates.signatureTypes.${c.signature_type}`)} />
        <InfoField label={t("certificates.fields.provider")} value={c.provider} />
        <InfoField label={t("certificates.fields.serialNumber")} value={c.serial_number} />
        <InfoField label={t("certificates.fields.active")} value={<Pill tone={c.active ? "green" : "gray"}>{c.active ? t("certificates.activeOn") : t("certificates.activeOff")}</Pill>} />
        <InfoField label={t("certificates.fields.activatedOn")} value={formatDate(c.activated_on)} />
        <InfoField label={t("certificates.fields.expiresOn")} value={formatDate(c.expires_on)} />
      </TabsContent>
      <TabsContent value="cert" className="grid grid-cols-2 gap-x-6 gap-y-3 px-5 py-4">
        <InfoField label={t("certificates.fields.publicCert")} value={c.has_certificate ? t("certificates.uploaded") : t("certificates.notUploaded")} />
        <InfoField label={t("certificates.fields.certStatus")} value={<Pill tone={certTone(c.cert_status)}>{t(`certificates.certStatuses.${c.cert_status}`)}</Pill>} />
        <InfoField label={t("certificates.fields.issuer")} value={c.issuer} className="col-span-2" />
      </TabsContent>
      <div className="flex justify-end gap-2 px-5 pb-4">
        <button type="button" disabled={del.isPending}
          onClick={() => window.confirm(t("certificates.confirmDelete", { name: c.subject_name })) && del.mutate({ method: "DELETE", id: c.id })}
          className="h-8 rounded-md border border-border px-3 text-[13px] font-semibold hover:bg-muted">{tc("actions.delete")}</button>
        <button type="button" onClick={onEdit}
          className="h-8 rounded-md bg-primary px-3 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90">{tc("actions.edit")}</button>
      </div>
    </Tabs>
  );
}

/** Hồ sơ cửa hàng → Quản lý chữ ký số (ảnh 187). Sắp hết hạn (≤ 30 ngày) → cảnh báo ở Hộp thư đến. */
export default function CertificatesPage() {
  const { data, error } = useQuery({ queryKey: CERTIFICATES_KEY, queryFn: () => api<Certificate[]>("/store-profile/certificates") });
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<Certificate | "new" | null>(null);
  const t = useT(storeProfileNs);
  return (
    <ProfileCard className="px-5 py-4">
      <div className="mb-3 flex items-center">
        <h2 className="text-[15px] font-semibold">{t("certificates.title")}</h2>
        <button type="button" onClick={() => setEditing("new")}
          className="ml-auto flex h-8 items-center gap-1 rounded-md border border-primary px-3 text-[13px] font-semibold text-primary hover:bg-primary/5">
          <Plus className="size-4" /> {t("certificates.add")}</button>
      </div>
      {error && <p className="text-[13px] text-destructive">{errorMessage(error)}</p>}
      <table className="w-full text-[13px]">
        <thead className="bg-primary/10 text-left text-xs font-semibold [&_th]:h-[34px] [&_th]:px-2.5">
          <tr><th>{t("certificates.fields.subjectName")}</th><th>{t("certificates.fields.taxCode")}</th><th>{t("certificates.fields.representative")}</th>
            <th>{t("certificates.fields.activatedOn")}</th><th>{t("certificates.fields.expiresOn")}</th>
            <th>{t("certificates.fields.certStatus")}</th><th>{t("certificates.fields.active")}</th></tr>
        </thead>
        <tbody>
          {data?.map((c) => (
            <Fragment key={c.id}>
              <tr onClick={() => setOpen(open === c.id ? null : c.id)}
                className={cn("cursor-pointer border-b border-border hover:bg-primary/5 [&_td]:px-2.5 [&_td]:py-2.5", open === c.id && "bg-primary/10")}>
                <td className="uppercase">{c.subject_name}</td><td>{c.tax_code}</td><td className="uppercase">{c.representative}</td>
                <td>{formatDate(c.activated_on)}</td><td>{formatDate(c.expires_on)}</td>
                <td><Pill tone={certTone(c.cert_status)}>{t(`certificates.certStatuses.${c.cert_status}`)}</Pill></td>
                <td><Pill tone={c.active ? "green" : "gray"}>{c.active ? t("certificates.activeOn") : t("certificates.activeOff")}</Pill></td>
              </tr>
              {open === c.id && (
                <tr><td colSpan={7} className="p-0">
                  <div className="rounded-b-lg border border-t-0 border-primary"><CertificateDetail c={c} onEdit={() => setEditing(c)} /></div>
                </td></tr>
              )}
            </Fragment>
          ))}
          {data && !data.length && <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">{t("certificates.empty")}</td></tr>}
        </tbody>
      </table>
      {editing && <CertificateFormDialog cert={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </ProfileCard>
  );
}
