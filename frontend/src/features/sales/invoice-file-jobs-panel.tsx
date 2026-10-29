"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronDown, ChevronUp, FileOutput, LoaderCircle, X } from "lucide-react";
import { errorMessage } from "@/lib/api-client";
import { useT } from "@/lib/i18n";
import { salesNs } from "@/messages/sales";

type Job = { id: number; name: string; state: "running" | "done" | "error"; url?: string; error?: string };

/** Hàng đợi file đang tạo ("Xuất file"): chạy nền, xong → link tải về trong panel góc phải dưới như KiotViet. */
export function useFileJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const seq = useRef(0);
  const urls = useRef<string[]>([]);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);
  const run = useCallback((pending: string, make: () => Promise<{ name: string; blob: Blob }>) => {
    const id = ++seq.current;
    setJobs((all) => [{ id, name: pending, state: "running" }, ...all]);
    make().then(({ name, blob }) => {
      const url = URL.createObjectURL(blob);
      urls.current.push(url);
      setJobs((all) => all.map((j) => (j.id === id ? { ...j, name, url, state: "done" } : j)));
    }).catch((e) => setJobs((all) => all.map((j) => (j.id === id ? { ...j, state: "error", error: errorMessage(e) } : j))));
  }, []);
  return { jobs, run, clear: () => setJobs([]) };
}

/** Panel "Xử lý thiết lập, import, xuất file, thanh toán": danh sách file, "Nhấn vào đây để tải xuống". */
export function FileJobsPanel({ jobs, onClose }: { jobs: Job[]; onClose: () => void }) {
  const t = useT(salesNs);
  const [collapsed, setCollapsed] = useState(false);
  if (!jobs.length) return null;
  return (
    <div className="fixed right-4 bottom-4 z-40 w-[376px] overflow-hidden rounded-lg bg-background text-[13px] shadow-xl" role="status">
      <div className="flex h-11 items-center gap-2 bg-primary px-4 font-semibold text-white">
        <span className="flex-1">{t("invoices.jobs.title")}</span>
        <button type="button" aria-label={collapsed ? t("invoices.jobs.expand") : t("invoices.jobs.collapse")} onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}</button>
        <button type="button" aria-label={t("invoices.jobs.close")} onClick={onClose}><X className="size-4" /></button>
      </div>
      {!collapsed && (
        <ul className="max-h-64 divide-y overflow-y-auto">
          {jobs.map((j) => (
            <li key={j.id} className="flex items-start gap-3 px-4 py-2.5">
              <FileOutput className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="break-all">{j.name}</p>
                {j.state === "done" && <a href={j.url} download={j.name} className="text-primary hover:underline">{t("invoices.jobs.download")}</a>}
                {j.state === "running" && <p className="text-muted-foreground">{t("invoices.jobs.running")}</p>}
                {j.state === "error" && <p className="text-destructive">{j.error}</p>}
              </div>
              {j.state === "running" ? <LoaderCircle className="size-4 shrink-0 animate-spin text-primary" />
                : j.state === "done" ? <Check className="size-4 shrink-0 text-primary" /> : <X className="size-4 shrink-0 text-destructive" />}
            </li>))}
        </ul>)}
    </div>
  );
}
