"use client";

import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SETTINGS_TABS } from "@/features/settings/settings-shell";
import {
  CERT_STATUSES, CERTIFICATES_KEY, CertificateFormDialog, SIGNATURE_TYPES, useCertificateMutation, type Certificate,
} from "@/features/store-profile/certificate-form-dialog";
import { InfoField, ProfileCard } from "@/features/store-profile/store-profile-shell";
import { api, errorMessage } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const labelOf = (opts: readonly (readonly [string, string])[], v: string) => opts.find(([k]) => k === v)?.[1] ?? v;

function Pill({ tone, children }: { tone: "green" | "gray" | "red"; children: React.ReactNode }) {
  return <span className={cn("rounded px-1.5 py-0.5 text-[12px]", tone === "green" && "bg-green-100 text-green-700",
    tone === "gray" && "bg-muted text-muted-foreground", tone === "red" && "bg-destructive/10 text-destructive")}>{children}</span>;
}

const certTone = (s: Certificate["cert_status"]) => (s === "APPROVED" ? "green" : s === "REVOKED" ? "red" : "gray");

/** Chi tiết mở rộng (ảnh 187): tab Thông tin chung / Chứng thư số + Sửa / Xóa. */
function CertificateDetail({ c, onEdit }: { c: Certificate; onEdit: () => void }) {
  const del = useCertificateMutation();
  return (
    <Tabs defaultValue="general" className="gap-0">
      <TabsList variant="line" className={SETTINGS_TABS.list}>
        <TabsTrigger value="general" className={SETTINGS_TABS.trigger}>Thông tin chung</TabsTrigger>
        <TabsTrigger value="cert" className={SETTINGS_TABS.trigger}>Chứng thư số</TabsTrigger>
      </TabsList>
      <TabsContent value="general" className="grid grid-cols-4 gap-x-6 gap-y-3 px-5 py-4">
        <InfoField label="Loại chữ ký" value={labelOf(SIGNATURE_TYPES, c.signature_type)} />
        <InfoField label="Nhà cung cấp" value={c.provider} />
        <InfoField label="Số Serial" value={c.serial_number} />
        <InfoField label="Trạng thái hoạt động" value={<Pill tone={c.active ? "green" : "gray"}>{c.active ? "Hoạt động" : "Ngừng hoạt động"}</Pill>} />
        <InfoField label="Ngày kích hoạt" value={formatDate(c.activated_on)} />
        <InfoField label="Ngày hết hạn" value={formatDate(c.expires_on)} />
      </TabsContent>
      <TabsContent value="cert" className="grid grid-cols-2 gap-x-6 gap-y-3 px-5 py-4">
        <InfoField label="Chứng thư số công khai" value={c.has_certificate ? "Đã tải lên (.cer)" : "Chưa tải lên — thông tin nhập tay"} />
        <InfoField label="Trạng thái chứng thư số" value={<Pill tone={certTone(c.cert_status)}>{labelOf(CERT_STATUSES, c.cert_status)}</Pill>} />
        <InfoField label="Tổ chức cấp (Issuer)" value={c.issuer} className="col-span-2" />
      </TabsContent>
      <div className="flex justify-end gap-2 px-5 pb-4">
        <button type="button" disabled={del.isPending}
          onClick={() => window.confirm(`Xóa chữ ký số "${c.subject_name}"?`) && del.mutate({ method: "DELETE", id: c.id })}
          className="h-8 rounded-md border border-border px-3 text-[13px] font-semibold hover:bg-muted">Xóa</button>
        <button type="button" onClick={onEdit}
          className="h-8 rounded-md bg-primary px-3 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90">Sửa</button>
      </div>
    </Tabs>
  );
}

/** Hồ sơ cửa hàng → Quản lý chữ ký số (ảnh 187). Sắp hết hạn (≤ 30 ngày) → cảnh báo ở Hộp thư đến. */
export default function CertificatesPage() {
  const { data, error } = useQuery({ queryKey: CERTIFICATES_KEY, queryFn: () => api<Certificate[]>("/store-profile/certificates") });
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<Certificate | "new" | null>(null);
  return (
    <ProfileCard className="px-5 py-4">
      <div className="mb-3 flex items-center">
        <h2 className="text-[15px] font-semibold">Danh sách chữ ký số</h2>
        <button type="button" onClick={() => setEditing("new")}
          className="ml-auto flex h-8 items-center gap-1 rounded-md border border-primary px-3 text-[13px] font-semibold text-primary hover:bg-primary/5">
          <Plus className="size-4" /> Thêm chữ ký số</button>
      </div>
      {error && <p className="text-[13px] text-destructive">{errorMessage(error)}</p>}
      <table className="w-full text-[13px]">
        <thead className="bg-primary/10 text-left text-xs font-semibold [&_th]:h-[34px] [&_th]:px-2.5">
          <tr><th>Tên chủ thể</th><th>Mã số thuế</th><th>Người đại diện</th><th>Ngày kích hoạt</th><th>Ngày hết hạn</th>
            <th>Trạng thái chứng thư số</th><th>Trạng thái hoạt động</th></tr>
        </thead>
        <tbody>
          {data?.map((c) => (
            <Fragment key={c.id}>
              <tr onClick={() => setOpen(open === c.id ? null : c.id)}
                className={cn("cursor-pointer border-b border-border hover:bg-primary/5 [&_td]:px-2.5 [&_td]:py-2.5", open === c.id && "bg-primary/10")}>
                <td className="uppercase">{c.subject_name}</td><td>{c.tax_code}</td><td className="uppercase">{c.representative}</td>
                <td>{formatDate(c.activated_on)}</td><td>{formatDate(c.expires_on)}</td>
                <td><Pill tone={certTone(c.cert_status)}>{labelOf(CERT_STATUSES, c.cert_status)}</Pill></td>
                <td><Pill tone={c.active ? "green" : "gray"}>{c.active ? "Hoạt động" : "Ngừng hoạt động"}</Pill></td>
              </tr>
              {open === c.id && (
                <tr><td colSpan={7} className="p-0">
                  <div className="rounded-b-lg border border-t-0 border-primary"><CertificateDetail c={c} onEdit={() => setEditing(c)} /></div>
                </td></tr>
              )}
            </Fragment>
          ))}
          {data && !data.length && <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">Chưa có chữ ký số</td></tr>}
        </tbody>
      </table>
      {editing && <CertificateFormDialog cert={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </ProfileCard>
  );
}
