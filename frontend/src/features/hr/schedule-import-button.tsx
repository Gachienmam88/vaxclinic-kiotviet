"use client";

import { useRef } from "react";
import { FileInput } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { useHrMutation } from "./hr-queries";
import { WEEK_BTN } from "./week-toolbar";
import { useT } from "@/lib/i18n";
import { hrNs } from "@/messages/hr";

type Row = { employeeCode: string; date: string; shiftName: string };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").toLowerCase().trim();

/** Tách 1 dòng CSV (dấu , ; hoặc tab, hỗ trợ ô trong ngoặc kép). */
function splitLine(line: string, sep: string) {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (quoted && line[i + 1] === '"') { cur += '"'; i++; } else quoted = !quoted;
    } else if (c === sep && !quoted) { out.push(cur.trim()); cur = ""; } else cur += c;
  }
  out.push(cur.trim());
  return out;
}

/** "26/10/2026" | "2026-10-26" → "2026-10-26"; sai định dạng → null. */
function toIso(v: string) {
  const s = v.trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
}

/** Đọc file CSV lịch làm việc: cột Mã nhân viên, Ngày, Ca (tìm theo tiêu đề; không có tiêu đề → 3 cột đầu). */
export function parseScheduleCsv(text: string): { rows: Row[]; bad: number } {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return { rows: [], bad: 0 };
  const sep = lines[0].includes("\t") ? "\t" : lines[0].includes(";") ? ";" : ",";
  const head = splitLine(lines[0], sep).map(norm);
  let code = head.findIndex((h) => h.includes("ma nhan vien") || h === "ma nv" || h === "ma");
  let date = head.findIndex((h) => h.startsWith("ngay"));
  let shift = head.findIndex((h) => h === "ca" || h.includes("ca lam viec") || h === "ten ca");
  const hasHeader = code >= 0 && date >= 0 && shift >= 0;
  if (!hasHeader) { code = 0; date = 1; shift = 2; }
  const rows: Row[] = [];
  let bad = 0;
  for (const line of lines.slice(hasHeader ? 1 : 0)) {
    const c = splitLine(line, sep);
    const iso = toIso(c[date] ?? "");
    if (!c[code] || !iso || !c[shift]) { bad++; continue; }
    rows.push({ employeeCode: c[code], date: iso, shiftName: c[shift] });
  }
  return { rows, bad };
}

/** Nút "Import" màn Lịch làm việc: chọn file .csv → POST /hr/schedules/import. */
export function ScheduleImportButton() {
  const t = useT(hrNs);
  const input = useRef<HTMLInputElement>(null);
  const run = useHrMutation((rows: Row[]) => api<{ created: number; errors: string[] }>("/hr/schedules/import", { method: "POST", body: { rows } }),
    undefined, (r) => {
      toast.success(t("scheduleImport.toastImported", { count: r.created }));
      if (r.errors.length) toast.warning(r.errors.slice(0, 5).join("\n") + (r.errors.length > 5 ? `\n${t("scheduleImport.moreErrors", { count: r.errors.length - 5 })}` : ""));
    });
  async function onFile(f: File | undefined) {
    if (!f) return;
    const { rows, bad } = parseScheduleCsv(await f.text());
    if (input.current) input.current.value = "";
    if (!rows.length) { toast.error(t("scheduleImport.noValidRows")); return; }
    if (bad) toast.warning(t("scheduleImport.skippedRows", { count: bad }));
    run.mutate(rows);
  }
  return (
    <>
      <button type="button" className={WEEK_BTN} disabled={run.isPending} title={t("scheduleImport.hint")}
        onClick={() => input.current?.click()}><FileInput className="size-4" /> {t("scheduleImport.button")}</button>
      <input ref={input} type="file" accept=".csv,.txt,text/csv" hidden onChange={(e) => onFile(e.target.files?.[0])} />
    </>
  );
}
