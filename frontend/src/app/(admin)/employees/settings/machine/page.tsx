"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SettingsCard, SettingsPage } from "@/features/settings/settings-layout-parts";
import { useBranches } from "@/features/settings/settings-queries";
import type { MachineImportResult } from "@/features/hr/hr-types";
import { ApiRequestError, errorMessage } from "@/lib/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useT } from "@/lib/i18n";
import { hrNs } from "@/messages/hr";
import { renderRichText } from "@/lib/i18n/render-rich-text";

/**
 * Máy chấm công vân tay / khuôn mặt: thay vì phần mềm kết nối của KiotViet, xuất file log từ máy (CSV / TXT / XLSX)
 * rồi nhập vào đây. Mỗi lượt quét được ghép vào ca theo Mã chấm công của nhân viên.
 */
export default function MachineSettingsPage() {
  const t = useT(hrNs);
  const qc = useQueryClient();
  const { data: branches = [] } = useBranches();
  const fileRef = useRef<HTMLInputElement>(null);
  const [branchId, setBranchId] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<MachineImportResult | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      if (branchId) form.append("branchId", branchId);
      const res = await fetch("/api/backend/hr/attendance/import", { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new ApiRequestError(res.status, body.code ?? "UNKNOWN", body.message ?? t("machine.importFailed"), body.details);
      setResult(body as MachineImportResult);
      toast.success(t("machine.toastRecorded", { count: (body as MachineImportResult).records }));
      qc.invalidateQueries({ queryKey: ["hr"] });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const step = (n: number, text: React.ReactNode) => (
    <p className="flex items-start gap-2"><span className="shrink-0 rounded bg-[#eff0f3] px-1.5 py-0.5 text-[12px] font-medium">{t("settings.step", { n })}</span><span>{text}</span></p>
  );
  return (
    <SettingsPage toc={[{ id: "machine", label: t("machine.toc") }]}>
      <SettingsCard id="machine" title={t("machine.title")} description={t("machine.description")}>
        <div className="space-y-3 px-5 py-4 text-[13px]">
          <p>{t("machine.intro")}</p>
          {step(1, t("machine.step1"))}
          {step(2, t("machine.step2"))}
          {step(3, t("machine.step3"))}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <select aria-label={t("machine.branch")} className="h-[30px] w-60 rounded-md border border-[#d9dbe0] bg-white px-2 text-[13px]"
              value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">{t("machine.branchOptional")}</option>
              {branches.filter((b) => b.active).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <input ref={fileRef} type="file" accept=".csv,.txt,.xlsx" className="hidden" aria-label={t("machine.file")}
              onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            <Button disabled={busy} onClick={() => fileRef.current?.click()}><Upload className="size-4" /> {busy ? t("machine.importing") : t("machine.pickFile")}</Button>
          </div>
          {result && (
            <div className="rounded-md border bg-[#f8fafc] p-3 leading-6">
              <p>{renderRichText(t("machine.resultSummary"), { rows: result.rows, punches: result.punches,
                records: <b>{t("machine.resultRecords", { records: result.records })}</b> })}</p>
              {result.unmatched > 0 && <p className="text-[#b45309]">{t("machine.unmatched", { count: result.unmatched })}</p>}
              {result.unknownCodes.length > 0 && <p className="text-[#b45309]">{t("machine.unknownCodes", { codes: result.unknownCodes.join(", ") })}</p>}
              {result.errors.map((e) => <p key={e} className="text-destructive">{e}</p>)}
            </div>
          )}
        </div>
      </SettingsCard>
    </SettingsPage>
  );
}
