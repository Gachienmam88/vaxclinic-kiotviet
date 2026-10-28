"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileUp } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api, ApiRequestError, errorMessage } from "@/lib/api-client";
import { FlowFooter } from "./store-flow-parts";

/** Dòng của GET /store-profile/certificates (integration-service, tên cột snake_case). */
export type Certificate = {
  id: string; subject_name: string; tax_code: string | null; representative: string | null;
  signature_type: "USB_TOKEN" | "HSM" | "RMS"; provider: string | null; serial_number: string | null;
  activated_on: string | null; expires_on: string; cert_status: "PENDING" | "APPROVED" | "REVOKED"; active: boolean;
  issuer: string | null; has_certificate: boolean;
};

export const SIGNATURE_TYPES = [["USB_TOKEN", "USB Token"], ["HSM", "HSM"], ["RMS", "RMS (Chữ ký số từ xa)"]] as const;
export const CERT_STATUSES = [["PENDING", "Chờ duyệt CTS"], ["APPROVED", "Đã duyệt CTS"], ["REVOKED", "Đã thu hồi"]] as const;
export const CERTIFICATES_KEY = ["store-profile", "certificates"];

const SELECT = "h-9 w-full rounded-md border border-input bg-background px-2.5 text-[13px] outline-none focus:border-primary";

export function useCertificateMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ method, id, body }: { method: "POST" | "PUT" | "DELETE"; id?: string; body?: unknown }) =>
      api<Certificate[]>(`/store-profile/certificates${id ? `/${id}` : ""}`, { method, body }),
    onSuccess: (rows) => { qc.setQueryData(CERTIFICATES_KEY, rows); toast.success("Đã lưu danh sách chữ ký số"); },
    onError: (e) => toast.error(errorMessage(e)),
  });
}

/** Đọc file .cer ở server (CertificateFactory) để điền sẵn form — không lưu gì cho tới khi bấm Lưu. */
async function parseCertificate(file: File) {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch("/api/backend/store-profile/certificates/parse", { method: "POST", body });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiRequestError(res.status, json.code ?? "UNKNOWN", json.message ?? "Không đọc được chứng thư số", json.details);
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
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const save = useCertificateMutation();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const valid = !!f.subjectName.trim() && !!f.expiresOn && (!f.activatedOn || f.expiresOn >= f.activatedOn);

  async function pick(file: File | undefined) {
    if (!file) return;
    try {
      const p = await parseCertificate(file);
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
        <DialogHeader><DialogTitle className="text-[17px] font-semibold">{cert ? "Sửa chữ ký số" : "Thêm chữ ký số"}</DialogTitle></DialogHeader>
        <div className="flex items-center gap-3 rounded-md border border-dashed border-border px-3 py-2.5 text-[13px]">
          <FileUp className="size-5 text-primary" />
          <div className="min-w-0 flex-1">
            <p>{fileName ?? (cert?.has_certificate ? "Đã lưu chứng thư số" : "Tải chứng thư số công khai (.cer, .crt) để tự điền thông tin")}</p>
            <p className="text-xs text-muted-foreground">Chỉ dùng file chứng thư công khai. Không bao giờ tải khóa bí mật (.pfx, .p12, .key).</p>
          </div>
          <button type="button" onClick={() => fileRef.current?.click()} className="h-8 rounded-md border border-border px-3 font-semibold hover:bg-muted">Chọn file</button>
          <input ref={fileRef} type="file" accept=".cer,.crt,.pem,.der" className="hidden" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
        </div>
        <div className="grid grid-cols-2 gap-3 text-[13px]">
          <div className="col-span-2">{field("Tên chủ thể", <Input value={f.subjectName} onChange={set("subjectName")} />, true)}</div>
          {field("Mã số thuế", <Input value={f.taxCode} maxLength={20} onChange={set("taxCode")} />)}
          {field("Người đại diện", <Input value={f.representative} onChange={set("representative")} />)}
          {field("Loại chữ ký", <select className={SELECT} value={f.signatureType} onChange={set("signatureType")}>
            {SIGNATURE_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>)}
          {field("Nhà cung cấp", <Input value={f.provider} placeholder="VD: IntrustCA, Viettel-CA, VNPT-CA" onChange={set("provider")} />)}
          <div className="col-span-2">{field("Số Serial", <Input value={f.serialNumber} onChange={set("serialNumber")} />)}</div>
          {field("Ngày kích hoạt", <DatePicker value={f.activatedOn} onChange={(v) => setF({ ...f, activatedOn: v })} />)}
          {field("Ngày hết hạn", <DatePicker value={f.expiresOn} onChange={(v) => setF({ ...f, expiresOn: v })} />, true)}
          {field("Trạng thái chứng thư số", <select className={SELECT} value={f.certStatus} onChange={set("certStatus")}>
            {CERT_STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>)}
          {field("Trạng thái hoạt động", <select className={SELECT} value={f.active ? "1" : "0"} onChange={(e) => setF({ ...f, active: e.target.value === "1" })}>
            <option value="1">Hoạt động</option><option value="0">Ngừng hoạt động</option></select>)}
        </div>
        <FlowFooter onCancel={onClose} nextLabel="Lưu" disabled={!valid || save.isPending}
          onNext={() => save.mutate({ method: cert ? "PUT" : "POST", id: cert?.id, body: { ...f, activatedOn: f.activatedOn || null } }, { onSuccess: onClose })} />
      </DialogContent>
    </Dialog>
  );
}
