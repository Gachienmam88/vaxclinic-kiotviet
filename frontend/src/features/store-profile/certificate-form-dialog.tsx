"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileUp } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api, ApiRequestError, errorMessage } from "@/lib/api-client";
import { useT } from "@/lib/i18n";
import { storeProfileNs } from "@/messages/store-profile";
import { commonNs } from "@/messages/common";
import { FlowFooter } from "./store-flow-parts";

/** Dòng của GET /store-profile/certificates (integration-service, tên cột snake_case). */
export type Certificate = {
  id: string; subject_name: string; tax_code: string | null; representative: string | null;
  signature_type: "USB_TOKEN" | "HSM" | "RMS"; provider: string | null; serial_number: string | null;
  activated_on: string | null; expires_on: string; cert_status: "PENDING" | "APPROVED" | "REVOKED"; active: boolean;
  issuer: string | null; has_certificate: boolean;
};

/** Nhãn: t(`certificates.signatureTypes.${v}`) / t(`certificates.certStatuses.${v}`) (namespace store-profile). */
export const SIGNATURE_TYPES = ["USB_TOKEN", "HSM", "RMS"] as const;
export const CERT_STATUSES = ["PENDING", "APPROVED", "REVOKED"] as const;
export const CERTIFICATES_KEY = ["store-profile", "certificates"];

const SELECT = "h-9 w-full rounded-md border border-input bg-background px-2.5 text-[13px] outline-none focus:border-primary";

export function useCertificateMutation() {
  const qc = useQueryClient();
  const t = useT(storeProfileNs);
  return useMutation({
    mutationFn: ({ method, id, body }: { method: "POST" | "PUT" | "DELETE"; id?: string; body?: unknown }) =>
      api<Certificate[]>(`/store-profile/certificates${id ? `/${id}` : ""}`, { method, body }),
    onSuccess: (rows) => { qc.setQueryData(CERTIFICATES_KEY, rows); toast.success(t("certificates.form.toast")); },
    onError: (e) => toast.error(errorMessage(e)),
  });
}

/** Đọc file .cer ở server (CertificateFactory) để điền sẵn form — không lưu gì cho tới khi bấm Lưu. */
async function parseCertificate(file: File, fallbackError: string) {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch("/api/backend/store-profile/certificates/parse", { method: "POST", body });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiRequestError(res.status, json.code ?? "UNKNOWN", json.message ?? fallbackError, json.details);
  return json as { subjectName: string | null; taxCode: string | null; provider: string | null; serialNumber: string;
    activatedOn: string; expiresOn: string; certificateBase64: string };
}

export function CertificateFormDialog({ cert, onClose }: { cert: Certificate | null; onClose: () => void }) {
  const [f, setF] = useState({
    subjectName: cert?.subject_name ?? "", taxCode: cert?.tax_code ?? "", representative: cert?.representative ?? "",
    signatureType: cert?.signature_type ?? "RMS", provider: cert?.provider ?? "", serialNumber: cert?.serial_number ?? "",
    activatedOn: cert?.activated_on ?? "", expiresOn: cert?.expires_on ?? "", certStatus: cert?.cert_status ?? "APPROVED",
    active: cert?.active ?? true, certificateBase64: null as string | null,
  });
  const t = useT(storeProfileNs);
  const tc = useT(commonNs);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const save = useCertificateMutation();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const valid = !!f.subjectName.trim() && !!f.expiresOn && (!f.activatedOn || f.expiresOn >= f.activatedOn);

  async function pick(file: File | undefined) {
    if (!file) return;
    try {
      const p = await parseCertificate(file, t("certificates.form.parseError"));
      setF((x) => ({ ...x, subjectName: p.subjectName ?? x.subjectName, taxCode: p.taxCode ?? x.taxCode, provider: p.provider ?? x.provider,
        serialNumber: p.serialNumber, activatedOn: p.activatedOn, expiresOn: p.expiresOn, certificateBase64: p.certificateBase64 }));
      setFileName(file.name);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  const field = (label: string, control: React.ReactNode, required?: boolean) => (
    <label className="grid gap-1"><span className="text-xs text-muted-foreground">{label}{required && <span className="text-destructive"> *</span>}</span>{control}</label>);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] gap-3 overflow-y-auto sm:max-w-[620px]">
        <DialogHeader><DialogTitle className="text-[17px] font-semibold">{cert ? t("certificates.form.titleEdit") : t("certificates.form.titleAdd")}</DialogTitle></DialogHeader>
        <div className="flex items-center gap-3 rounded-md border border-dashed border-border px-3 py-2.5 text-[13px]">
          <FileUp className="size-5 text-primary" />
          <div className="min-w-0 flex-1">
            <p>{fileName ?? (cert?.has_certificate ? t("certificates.form.savedCert") : t("certificates.form.uploadHint"))}</p>
            <p className="text-xs text-muted-foreground">{t("certificates.form.privateKeyWarning")}</p>
          </div>
          <button type="button" onClick={() => fileRef.current?.click()} className="h-8 rounded-md border border-border px-3 font-semibold hover:bg-muted">{t("certificates.form.pickFile")}</button>
          <input ref={fileRef} type="file" accept=".cer,.crt,.pem,.der" className="hidden" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
        </div>
        <div className="grid grid-cols-2 gap-3 text-[13px]">
          <div className="col-span-2">{field(t("certificates.fields.subjectName"), <Input value={f.subjectName} onChange={set("subjectName")} />, true)}</div>
          {field(t("certificates.fields.taxCode"), <Input value={f.taxCode} maxLength={20} onChange={set("taxCode")} />)}
          {field(t("certificates.fields.representative"), <Input value={f.representative} onChange={set("representative")} />)}
          {field(t("certificates.fields.signatureType"), <select className={SELECT} value={f.signatureType} onChange={set("signatureType")}>
            {SIGNATURE_TYPES.map((v) => <option key={v} value={v}>{t(`certificates.signatureTypes.${v}`)}</option>)}</select>)}
          {field(t("certificates.fields.provider"), <Input value={f.provider} placeholder={t("certificates.form.providerPlaceholder")} onChange={set("provider")} />)}
          <div className="col-span-2">{field(t("certificates.fields.serialNumber"), <Input value={f.serialNumber} onChange={set("serialNumber")} />)}</div>
          {field(t("certificates.fields.activatedOn"), <DatePicker value={f.activatedOn} onChange={(v) => setF({ ...f, activatedOn: v })} />)}
          {field(t("certificates.fields.expiresOn"), <DatePicker value={f.expiresOn} onChange={(v) => setF({ ...f, expiresOn: v })} />, true)}
          {field(t("certificates.fields.certStatus"), <select className={SELECT} value={f.certStatus} onChange={set("certStatus")}>
            {CERT_STATUSES.map((v) => <option key={v} value={v}>{t(`certificates.certStatuses.${v}`)}</option>)}</select>)}
          {field(t("certificates.fields.active"), <select className={SELECT} value={f.active ? "1" : "0"} onChange={(e) => setF({ ...f, active: e.target.value === "1" })}>
            <option value="1">{t("certificates.activeOn")}</option><option value="0">{t("certificates.activeOff")}</option></select>)}
        </div>
        <FlowFooter onCancel={onClose} nextLabel={tc("actions.save")} disabled={!valid || save.isPending}
          onNext={() => save.mutate({ method: cert ? "PUT" : "POST", id: cert?.id, body: { ...f, activatedOn: f.activatedOn || null } }, { onSuccess: onClose })} />
      </DialogContent>
    </Dialog>
  );
}
