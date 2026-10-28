"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, errorMessage } from "@/lib/api-client";
import type { TaxConnection } from "./integration-queries";
import { DatePicker } from "@/components/ui/date-picker";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { purchasesNs } from "@/messages/purchases";

const PORTAL = "https://hoadondientu.gdt.gov.vn";

/** Thêm / sửa kết nối cổng hóa đơn điện tử của cơ quan thuế (MST + tài khoản + mật khẩu). */
export function TaxConnectionDialog({ connection, onClose }: { connection?: TaxConnection; onClose: () => void }) {
  const qc = useQueryClient();
  const t = useT(purchasesNs);
  const tc = useT(commonNs);
  const [f, setF] = useState({ taxCode: connection?.taxCode ?? "", username: connection?.username ?? "", password: "" });
  const save = useMutation({
    mutationFn: () => connection
      ? api(`/tax-connections/${connection.id}`, { method: "PUT", body: f })
      : api("/tax-connections", { method: "POST", body: f }),
    onSuccess: () => { toast.success(t("inputInvoices.dialog.toastSaved")); qc.invalidateQueries({ queryKey: ["tax-connections"] }); onClose(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-lg p-5 sm:max-w-md">
        <DialogHeader><DialogTitle className="text-base font-bold">{connection ? t("inputInvoices.dialog.editTitle") : t("inputInvoices.dialog.addTitle")}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">{t("inputInvoices.dialog.hint", { portal: PORTAL })}</p>
        <div className="grid gap-3">
          <div className="grid gap-1.5"><Label>{t("inputInvoices.filter.taxCode")}</Label><Input value={f.taxCode} onChange={(e) => setF({ ...f, taxCode: e.target.value, username: f.username || e.target.value })} /></div>
          <div className="grid gap-1.5"><Label>{t("inputInvoices.connections.username")}</Label><Input value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} /></div>
          <div className="grid gap-1.5"><Label>{t("inputInvoices.connections.password")} {connection && t("inputInvoices.dialog.passwordKeep")}</Label>
            <Input type="password" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
        </div>
        <DialogFooter className="-mx-5 -mb-5 rounded-b-lg bg-background px-5 py-3">
          <Button variant="outline" className="h-8 rounded-md px-3" onClick={onClose}>{tc("actions.skip")}</Button>
          <Button className="h-8 rounded-md px-4" disabled={save.isPending || !f.taxCode || !f.username || (!connection && !f.password)} onClick={() => save.mutate()}>{tc("actions.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);

/**
 * Đồng bộ hóa đơn đầu vào: lấy captcha từ cổng thuế → người dùng gõ mã → đồng bộ khoảng ngày (tối đa 1 tháng).
 * Captcha hiển thị bằng <img> từ data URL (SVG trong <img> không chạy được script).
 */
export function SyncDialog({ connections, onClose }: { connections: TaxConnection[]; onClose: () => void }) {
  const qc = useQueryClient();
  const t = useT(purchasesNs);
  const tc = useT(commonNs);
  const now = new Date();
  const [connectionId, setConnectionId] = useState(connections[0]?.id ?? "");
  const [from, setFrom] = useState(iso(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [to, setTo] = useState(iso(now));
  const [captcha, setCaptcha] = useState<{ key: string; svg: string } | null>(null);
  const [value, setValue] = useState("");

  const loadCaptcha = useMutation({
    mutationFn: () => api<{ key: string; svg: string }>(`/tax-connections/${connectionId}/captcha`, { method: "POST" }),
    onSuccess: (c) => { setCaptcha(c); setValue(""); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const sync = useMutation({
    mutationFn: () => api<{ found: number; added: number }>(`/tax-connections/${connectionId}/sync`, { method: "POST",
      body: { captchaKey: captcha!.key, captchaValue: value, from, to } }),
    onSuccess: (r) => {
      toast.success(t("inputInvoices.syncDialog.toastSynced", { found: r.found, added: r.added }));
      qc.invalidateQueries({ queryKey: ["input-invoices"] });
      qc.invalidateQueries({ queryKey: ["tax-connections"] });
      onClose();
    },
    onError: (e) => { toast.error(errorMessage(e)); loadCaptcha.mutate(); qc.invalidateQueries({ queryKey: ["tax-connections"] }); },
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-lg p-5 sm:max-w-md">
        <DialogHeader><DialogTitle className="text-base font-bold">{t("inputInvoices.syncDialog.title")}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5"><Label>{t("inputInvoices.syncDialog.connection")}</Label>
            <select className="h-8 rounded-md border bg-background px-2 text-sm outline-none focus-visible:border-primary" value={connectionId} onChange={(e) => { setConnectionId(e.target.value); setCaptcha(null); }}>
              {connections.map((c) => <option key={c.id} value={c.id}>{c.taxCode}</option>)}
            </select></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>{t("inputInvoices.syncDialog.from")}</Label><DatePicker value={from} onChange={(v) => setFrom(v)} /></div>
            <div className="grid gap-1.5"><Label>{t("inputInvoices.syncDialog.to")}</Label><DatePicker value={to} onChange={(v) => setTo(v)} /></div>
          </div>
          <div className="grid gap-1.5">
            <Label>{t("inputInvoices.syncDialog.captcha")}</Label>
            <div className="flex items-center gap-2">
              {captcha
                // eslint-disable-next-line @next/next/no-img-element -- data URL captcha, nothing to optimize
                ? <img alt="captcha" className="h-12 rounded border bg-white" src={`data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(captcha.svg)))}`} />
                : <span className="text-sm text-muted-foreground">{t("inputInvoices.syncDialog.captchaHint")}</span>}
              <Button type="button" variant="outline" size="sm" disabled={!connectionId || loadCaptcha.isPending} onClick={() => loadCaptcha.mutate()}>
                <RefreshCw className="size-3.5" /> {t("inputInvoices.syncDialog.getCode")}</Button>
            </div>
            <Input placeholder={t("inputInvoices.syncDialog.captchaPlaceholder")} value={value} disabled={!captcha} onChange={(e) => setValue(e.target.value)} />
          </div>
        </div>
        <DialogFooter className="-mx-5 -mb-5 rounded-b-lg bg-background px-5 py-3">
          <Button variant="outline" className="h-8 rounded-md px-3" onClick={onClose}>{tc("actions.skip")}</Button>
          <Button className="h-8 rounded-md px-4" disabled={!captcha || !value || sync.isPending} onClick={() => sync.mutate()}>
            {sync.isPending ? t("inputInvoices.syncDialog.syncing") : t("inputInvoices.syncDialog.submit")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
