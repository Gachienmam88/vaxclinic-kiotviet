"use client";

import { FileOutput } from "lucide-react";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";

type Cell = string | number | null | undefined;

/** Bọc ô CSV: luôn đặt trong ngoặc kép, nhân đôi dấu ngoặc kép bên trong. */
const esc = (v: Cell) => `"${String(v ?? "").replace(/"/g, '""')}"`;

/** Tải file CSV (UTF-8 có BOM để Excel đọc đúng tiếng Việt), xử lý hoàn toàn ở trình duyệt. */
export function downloadCsv(filename: string, header: string[], rows: Cell[][]) {
  const text = "﻿" + [header, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Nút chữ "Xuất file" kiểu KiotViet (không viền, icon bên trái). */
export function CsvExportButton({ label, disabled, onClick }: { label?: string; disabled?: boolean; onClick: () => void }) {
  const tc = useT(commonNs);
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      className="flex h-8 items-center gap-1.5 rounded-md px-2 text-[13px] font-semibold text-foreground hover:bg-[#edeef0] disabled:opacity-40">
      <FileOutput className="size-4" /> {label ?? tc("actions.export")}
    </button>
  );
}
