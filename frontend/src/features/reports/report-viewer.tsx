"use client";

import { useRef, useState } from "react";
import {
  ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, CloudDownload, FileText, Maximize, Printer, Redo2,
  RefreshCw, Search, Undo2, ZoomIn, ZoomOut,
} from "lucide-react";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { reportsNs } from "@/messages/reports";
import { madeAt, printReportHtml, REPORT_CSS } from "./report-print";

const ICON = "flex size-7 items-center justify-center rounded text-white/90 hover:bg-white/15 disabled:opacity-40 disabled:hover:bg-transparent";

/**
 * Khung xem báo cáo kiểu KiotViet: thanh công cụ xám (hoàn tác, làm mới, trang 1/1, xuất file, in, phóng to/thu nhỏ,
 * toàn màn hình) + tờ giấy trắng A4 (dọc/ngang) chứa tiêu đề, dòng thông tin và bảng số liệu.
 */
export function ReportViewer({ title, meta, note, landscape, onExport, onRefresh, loading, children }: {
  title: string; meta: string[]; note?: string; landscape?: boolean; onExport?: () => void; onRefresh?: () => void;
  loading?: boolean; children: React.ReactNode;
}) {
  const t = useT(reportsNs);
  const box = useRef<HTMLDivElement>(null);
  const paper = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [menu, setMenu] = useState(false);
  const print = () => paper.current && printReportHtml(paper.current.innerHTML, !!landscape);
  const fullscreen = () => (document.fullscreenElement ? document.exitFullscreen() : box.current?.requestFullscreen());

  return (
    <div ref={box} className="overflow-hidden rounded-md bg-[#858d97]">
      <style>{REPORT_CSS}</style>
      <div className="flex h-9 items-center justify-center gap-1.5 text-xs text-white">
        <button type="button" className={ICON} disabled title={t("viewer.undo")}><Undo2 className="size-4" /></button>
        <button type="button" className={ICON} disabled title={t("viewer.redo")}><Redo2 className="size-4" /></button>
        <button type="button" className={ICON} title={t("viewer.refresh")} onClick={onRefresh}><RefreshCw className={cn("size-4", loading && "animate-spin")} /></button>
        <button type="button" className={ICON} disabled title={t("viewer.firstPage")}><ChevronsLeft className="size-4" /></button>
        <button type="button" className={ICON} disabled title={t("viewer.prevPage")}><ChevronLeft className="size-4" /></button>
        <span className="flex items-center gap-1"><span className="flex h-5 w-8 items-center justify-center rounded-sm bg-white text-foreground">1</span> / 1</span>
        <button type="button" className={ICON} disabled title={t("viewer.nextPage")}><ChevronRight className="size-4" /></button>
        <button type="button" className={ICON} disabled title={t("viewer.lastPage")}><ChevronsRight className="size-4" /></button>
        <button type="button" className={ICON} title={t("viewer.export")} onClick={onExport} disabled={!onExport}><FileText className="size-4" /></button>
        <div className="relative">
          <button type="button" className={cn(ICON, "w-9")} title={t("viewer.download")} disabled={!onExport} onClick={() => setMenu(!menu)}>
            <CloudDownload className="size-4" /><ChevronDown className="size-3" /></button>
          {menu && onExport && (
            <div className="absolute top-8 left-0 z-30 w-44 rounded-md border bg-background py-1 text-foreground shadow-lg">
              <button type="button" className="block w-full px-3 py-1.5 text-left hover:bg-primary-tint" onClick={() => { setMenu(false); onExport(); }}>{t("viewer.excel")}</button>
              <button type="button" className="block w-full px-3 py-1.5 text-left hover:bg-primary-tint" onClick={() => { setMenu(false); print(); }}>{t("viewer.pdf")}</button>
            </div>)}
        </div>
        <button type="button" className={ICON} title={t("viewer.print")} onClick={print}><Printer className="size-4" /></button>
        <button type="button" className={ICON} title={t("viewer.zoomIn")} onClick={() => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(1)))}><ZoomIn className="size-4" /></button>
        <button type="button" className={ICON} title={t("viewer.zoomOut")} onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(1)))}><ZoomOut className="size-4" /></button>
        <button type="button" className={ICON} title={t("viewer.actualSize", { percent: Math.round(zoom * 100) })} onClick={() => setZoom(1)}><Search className="size-4" /></button>
        <button type="button" className={ICON} title={t("viewer.fullscreen")} onClick={fullscreen}><Maximize className="size-4" /></button>
      </div>
      <div className="max-h-[calc(100vh-150px)] overflow-auto px-3 pb-6 [:fullscreen_&]:max-h-[calc(100vh-36px)]">
        <div ref={paper} style={{ zoom }}
          className={cn("rp mx-auto min-h-[815px] bg-white px-[10px] pt-3 pb-10 shadow", landscape ? "w-[790px]" : "w-[578px]")}>
          <div className="rp-made">{t("viewer.madeAt", { time: madeAt() })}</div>
          <p className="rp-title" style={{ marginTop: -14 }}>{title}</p>
          {meta.map((m) => <p key={m} className="rp-meta">{m}</p>)}
          {note && <p className="rp-note">{note}</p>}
          {children}
        </div>
      </div>
    </div>
  );
}
