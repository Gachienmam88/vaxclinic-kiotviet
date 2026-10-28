"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlugZap, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/features/products/product-form-sections";
import { SettingRow, SettingsCard, SettingsPage } from "@/features/settings/settings-shell";
import { api, errorMessage } from "@/lib/api-client";

type Settings = { configured: boolean; environment: "TEST" | "PROD"; appId?: string; taxCode?: string; username?: string;
  invSeries?: string; invoiceName: string; sendEmail?: boolean };

/** Thiết lập kết nối MISA meInvoice — hóa đơn khởi tạo từ máy tính tiền. */
export default function EInvoiceSettingsPage() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["einvoice-settings"], queryFn: () => api<Settings>("/einvoice/settings") });
  const [f, setF] = useState({ environment: "TEST", appId: "", taxCode: "", username: "", password: "", invSeries: "",
    invoiceName: "Hóa đơn bán hàng", sendEmail: false });
  useEffect(() => {
    if (data) setF((x) => ({ ...x, environment: data.environment, appId: data.appId ?? "", taxCode: data.taxCode ?? "",
      username: data.username ?? "", invSeries: data.invSeries ?? "", invoiceName: data.invoiceName, sendEmail: !!data.sendEmail }));
  }, [data]);
  const bind = (k: "appId" | "taxCode" | "username" | "password" | "invSeries" | "invoiceName") =>
    ({ value: f[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value }) });

  const save = useMutation({
    mutationFn: () => api("/einvoice/settings", { method: "PUT", body: f }),
    onSuccess: () => { toast.success("Đã lưu thiết lập"); setF((x) => ({ ...x, password: "" })); qc.invalidateQueries({ queryKey: ["einvoice-settings"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const test = useMutation({
    mutationFn: () => api("/einvoice/settings/test", { method: "POST" }),
    onSuccess: () => toast.success("Kết nối MISA meInvoice thành công"),
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <SettingsPage toc={[{ id: "einvoice", label: "Hóa đơn điện tử" }, { id: "connection", label: "Thiết lập kết nối" }]}>
      <SettingsCard id="einvoice" title="Hóa đơn điện tử" description="Xuất hóa đơn điện tử khởi tạo từ máy tính tiền qua MISA meInvoice (không cần USB Token)."
        action={<span className={data?.configured ? "rounded bg-primary-tint px-1.5 py-0.5 text-xs text-primary" : "rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"}>
          {data?.configured ? "Đã kết nối" : "Chưa kết nối"}</span>}>
        <SettingRow title="Nhà cung cấp hóa đơn điện tử"
          description={<>MISA meInvoice. AppID do MISA cấp khi đăng ký tích hợp. Nên chạy thử ở môi trường <b>Thử nghiệm</b> trước khi chuyển sang Chính thức.</>} />
      </SettingsCard>
      <SettingsCard id="connection" title="Thiết lập kết nối hóa đơn điện tử" description="Thông tin tài khoản meInvoice và ký hiệu hóa đơn dùng khi phát hành.">
        <div className="space-y-4 px-5 py-4 text-[13px]">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="grid gap-1.5"><Label>Môi trường</Label>
              <NativeSelect value={f.environment} onChange={(e) => setF({ ...f, environment: e.target.value })}>
                <option value="TEST">Thử nghiệm (testapi.meinvoice.vn)</option><option value="PROD">Chính thức (api.meinvoice.vn)</option></NativeSelect></div>
            <div className="grid gap-1.5"><Label>AppID (MISA cấp)</Label><Input {...bind("appId")} /></div>
            <div className="grid gap-1.5"><Label>Mã số thuế</Label><Input {...bind("taxCode")} /></div>
            <div className="grid gap-1.5"><Label>Tài khoản meInvoice</Label><Input {...bind("username")} /></div>
            <div className="grid gap-1.5"><Label>Mật khẩu {data?.configured && "(bỏ trống nếu giữ nguyên)"}</Label>
              <Input type="password" autoComplete="new-password" {...bind("password")} /></div>
            <div className="grid gap-1.5"><Label>Ký hiệu hóa đơn</Label><Input placeholder="VD: 2C26MAA" {...bind("invSeries")} /></div>
            <div className="grid gap-1.5 md:col-span-2"><Label>Tên hóa đơn</Label>
              <NativeSelect value={f.invoiceName} onChange={(e) => setF({ ...f, invoiceName: e.target.value })}>
                <option>Hóa đơn bán hàng</option><option>Hóa đơn giá trị gia tăng</option></NativeSelect></div>
            <label className="flex items-center gap-2 md:col-span-2">
              <Checkbox checked={f.sendEmail} onCheckedChange={(v) => setF({ ...f, sendEmail: v === true })} />
              Tự gửi email hóa đơn cho khách (khi khách có email)</label>
          </div>
          <div className="flex justify-end gap-2 border-t border-[#eceef1] pt-3">
            <Button variant="outline" disabled={!data?.configured || test.isPending} onClick={() => test.mutate()}><PlugZap className="size-4" /> Kiểm tra kết nối</Button>
            <Button disabled={save.isPending || (!data?.configured && !f.password)} onClick={() => save.mutate()}><Save className="size-4" /> Lưu</Button>
          </div>
        </div>
      </SettingsCard>
    </SettingsPage>
  );
}
