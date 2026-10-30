"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { kvDialog, kvDialogFooter, kvDialogHeader, kvDialogTitle, kvFooterBtn, kvLabel, kvTabsList, kvTabsTrigger } from "@/features/sales/customer-ui-primitives";
import { api, errorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { TaxConnection } from "./integration-queries";
import { SyncHistoryTable } from "./sync-history-table";
import { useT } from "@/lib/i18n";
import { inputInvoicesNs } from "@/messages/input-invoices";

const FIELD = "h-8 w-full rounded-md border border-[#d9dbe0] bg-background px-2.5 text-[13px] outline-none focus-visible:border-primary";
const DAY = 86_400_000;

/**
 * "Đồng bộ từ Cơ quan Thuế": bước 1 chọn MST + khoảng ngày (bắt buộc, tối đa 31 ngày) → bước 2 cổng thuế trả captcha,
 * người dùng gõ mã → đồng bộ. Tab "Lịch sử đồng bộ" = các lần đồng bộ trước (thành công / lỗi, người chạy).
 * Captcha hiển thị bằng <img> từ data URL (SVG trong <img> không chạy được script).
 */
export function SyncDialog({ connections, onClose }: { connections: TaxConnection[]; onClose: () => void }) {
  const qc = useQueryClient();
  const t = useT(inputInvoicesNs);
  const active = connections.filter((c) => c.active);
  const [tab, setTab] = useState("time");
  const [connectionId, setConnectionId] = useState(active.length === 1 ? active[0].id : "");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [captcha, setCaptcha] = useState<{ key: string; svg: string } | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const rangeError = !from || !to ? null
    : to < from ? t("sync.rangeInvalid")
    : (new Date(to).getTime() - new Date(from).getTime()) / DAY > 31 ? t("sync.rangeTooLong") : null;

  const loadCaptcha = useMutation({
    mutationFn: () => api<{ key: string; svg: string }>(`/tax-connections/${connectionId}/captcha`, { method: "POST" }),
    onSuccess: (c) => { setCaptcha(c); setValue(""); setError(null); },
    onError: (e) => { const m = errorMessage(e); setError(m); toast.error(m); },
  });
  const sync = useMutation({
    mutationFn: () => api<{ found: number; added: number }>(`/tax-connections/${connectionId}/sync`, { method: "POST",
      body: { captchaKey: captcha!.key, captchaValue: value.trim(), from, to } }),
    onSuccess: (r) => {
      toast.success(t("sync.toastDone", { n: r.added }));
      ["input-invoices", "tax-connections", "tax-sync-logs", "input-invoice-sellers", "input-invoice-buyers"]
        .forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      onClose();
    },
    onError: (e) => {
      const m = errorMessage(e);
      setError(m);
      toast.error(m);
      qc.invalidateQueries({ queryKey: ["tax-connections"] });
      qc.invalidateQueries({ queryKey: ["tax-sync-logs"] });
      loadCaptcha.mutate(); // captcha chỉ dùng 1 lần
    },
  });

  const step1Ready = !!connectionId && !!from && !!to && !rangeError;
  function submit() {
    if (!captcha) return step1Ready ? loadCaptcha.mutate() : setError(rangeError ?? t("sync.required"));
    if (!value.trim()) return setError(t("sync.captchaRequired"));
    sync.mutate();
  }
  const busy = loadCaptcha.isPending || sync.isPending;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={cn(kvDialog, "sm:max-w-[600px]")}>
        <DialogHeader className={kvDialogHeader}><DialogTitle className={kvDialogTitle}>{t("sync.title")}</DialogTitle></DialogHeader>
        <Tabs value={tab} onValueChange={(v) => setTab(String(v))} className="gap-0">
          <TabsList variant="line" className={cn(kvTabsList, "px-5")}>
            <TabsTrigger value="time" className={kvTabsTrigger}>{t("sync.tabTime")}</TabsTrigger>
            <TabsTrigger value="history" className={kvTabsTrigger}>{t("sync.tabHistory")}</TabsTrigger>
          </TabsList>
          <TabsContent value="time" className="space-y-3 px-5 py-4">
            <div className="grid gap-1.5"><Label className={kvLabel} htmlFor="sync-taxcode">{t("sync.taxCode")}</Label>
              <select id="sync-taxcode" className={FIELD} value={connectionId} disabled={!!captcha}
                onChange={(e) => { setConnectionId(e.target.value); setCaptcha(null); }}>
                <option value="">{t("sync.required")}</option>
                {active.map((c) => <option key={c.id} value={c.id}>{c.taxCode}</option>)}
              </select></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5"><Label className={kvLabel}>{t("sync.from")}</Label>
                <DatePicker value={from} disabled={!!captcha} placeholder={t("sync.required")} onChange={(v) => setFrom(v)} /></div>
              <div className="grid gap-1.5"><Label className={kvLabel}>{t("sync.to")}</Label>
                <DatePicker value={to} disabled={!!captcha} placeholder={t("sync.required")} onChange={(v) => setTo(v)} /></div>
            </div>
            {rangeError && <p role="alert" className="text-xs text-destructive">{rangeError}</p>}
            {captcha && (
              <div className="grid gap-1.5 rounded-md border border-dashed p-3">
                <Label className={kvLabel} htmlFor="sync-captcha">{t("sync.captcha")}</Label>
                <div className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element -- data URL captcha, nothing to optimize */}
                  <img alt={t("sync.captcha")} className="h-12 rounded border bg-white" src={`data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(captcha.svg)))}`} />
                  <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => loadCaptcha.mutate()}>
                    <RefreshCw className="size-3.5" /> {t("sync.refreshCaptcha")}</Button>
                </div>
                <Input id="sync-captcha" autoFocus placeholder={t("sync.captchaPlaceholder")} value={value}
                  onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />
              </div>
            )}
            {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
          </TabsContent>
          <TabsContent value="history" className="px-5 py-4"><SyncHistoryTable active={tab === "history"} /></TabsContent>
        </Tabs>
        <DialogFooter className={kvDialogFooter}>
          <Button variant="outline" className={kvFooterBtn} onClick={captcha ? () => { setCaptcha(null); setError(null); } : onClose}>
            {captcha ? t("sync.back") : t("common.skip")}</Button>
          {tab === "time" && (
            <Button className={kvFooterBtn} disabled={busy || (!captcha && !step1Ready) || (!!captcha && !value.trim())} onClick={submit}>
              {sync.isPending ? t("sync.syncing") : t("sync.submit")}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
