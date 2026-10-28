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
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { settingsNs } from "@/messages/settings";

type Settings = { configured: boolean; environment: "TEST" | "PROD"; appId?: string; taxCode?: string; username?: string;
  invSeries?: string; invoiceName: string; sendEmail?: boolean };

/** Thiết lập kết nối MISA meInvoice — hóa đơn khởi tạo từ máy tính tiền. */
export default function EInvoiceSettingsPage() {
  const qc = useQueryClient();
  const t = useT(settingsNs);
  const tc = useT(commonNs);
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
    onSuccess: () => { toast.success(t("einvoice.saved")); setF((x) => ({ ...x, password: "" })); qc.invalidateQueries({ queryKey: ["einvoice-settings"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const test = useMutation({
    mutationFn: () => api("/einvoice/settings/test", { method: "POST" }),
    onSuccess: () => toast.success(t("einvoice.testOk")),
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <SettingsPage toc={[{ id: "einvoice", label: t("einvoice.tocEInvoice") }, { id: "connection", label: t("einvoice.tocConnection") }]}>
      <SettingsCard id="einvoice" title={t("einvoice.title")}
        description={<>{t("einvoice.description")}<span className="mt-1 block text-xs">{tc("legal.vietnameseOnly")}</span></>}
        action={<span className={data?.configured ? "rounded bg-primary-tint px-1.5 py-0.5 text-xs text-primary" : "rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"}>
          {data?.configured ? t("einvoice.connected") : t("einvoice.notConnected")}</span>}>
        <SettingRow title={t("einvoice.provider")}
          description={<>{t("einvoice.providerDescBefore")} <b>{t("einvoice.providerDescTest")}</b> {t("einvoice.providerDescAfter")}</>} />
      </SettingsCard>
      <SettingsCard id="connection" title={t("einvoice.connectionTitle")} description={t("einvoice.connectionDesc")}>
        <div className="space-y-4 px-5 py-4 text-[13px]">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="grid gap-1.5"><Label>{t("einvoice.environment")}</Label>
              <NativeSelect value={f.environment} onChange={(e) => setF({ ...f, environment: e.target.value })}>
                <option value="TEST">{t("einvoice.envTest")}</option><option value="PROD">{t("einvoice.envProd")}</option></NativeSelect></div>
            <div className="grid gap-1.5"><Label>{t("einvoice.appId")}</Label><Input {...bind("appId")} /></div>
            <div className="grid gap-1.5"><Label>{t("einvoice.taxCode")}</Label><Input {...bind("taxCode")} /></div>
            <div className="grid gap-1.5"><Label>{t("einvoice.username")}</Label><Input {...bind("username")} /></div>
            <div className="grid gap-1.5"><Label>{t("einvoice.password")} {data?.configured && t("einvoice.passwordKeep")}</Label>
              <Input type="password" autoComplete="new-password" {...bind("password")} /></div>
            <div className="grid gap-1.5"><Label>{t("einvoice.series")}</Label><Input placeholder={t("einvoice.seriesPlaceholder")} {...bind("invSeries")} /></div>
            <div className="grid gap-1.5 md:col-span-2"><Label title={tc("legal.vietnameseOnly")}>{t("einvoice.invoiceName")}</Label>
              <NativeSelect value={f.invoiceName} onChange={(e) => setF({ ...f, invoiceName: e.target.value })}>
                <option>Hóa đơn bán hàng</option><option>Hóa đơn giá trị gia tăng</option></NativeSelect></div>
            <label className="flex items-center gap-2 md:col-span-2">
              <Checkbox checked={f.sendEmail} onCheckedChange={(v) => setF({ ...f, sendEmail: v === true })} />
              {t("einvoice.sendEmail")}</label>
          </div>
          <div className="flex justify-end gap-2 border-t border-[#eceef1] pt-3">
            <Button variant="outline" disabled={!data?.configured || test.isPending} onClick={() => test.mutate()}><PlugZap className="size-4" /> {t("einvoice.test")}</Button>
            <Button disabled={save.isPending || (!data?.configured && !f.password)} onClick={() => save.mutate()}><Save className="size-4" /> {tc("actions.save")}</Button>
          </div>
        </div>
      </SettingsCard>
    </SettingsPage>
  );
}
