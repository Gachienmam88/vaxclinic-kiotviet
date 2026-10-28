"use client";

import { useState } from "react";
import { ChevronDown, RefreshCw, Trash2, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDateTime, formatMoney } from "@/lib/format";
import { POS_TABLE_HEAD, PosTableEmpty } from "./pos-dialog-parts";
import type { QueuedInvoice } from "./pos-types";

const KINDS = [["", "--Tất cả--"], ["INVOICE", "Hóa đơn"], ["RETURN", "Trả hàng"], ["ORDER", "Đặt hàng"]] as const;
const kindLabel = (k: QueuedInvoice["kind"]) => KINDS.find(([v]) => v === (k ?? "INVOICE"))?.[1] ?? "Hóa đơn";

type Props = {
  queue: QueuedInvoice[]; online: boolean; onSyncAll: () => void; onRetry: (id: string) => void; onRemove: (id: string) => void;
  onClose: () => void;
};

/**
 * "Đồng bộ phiếu": phiếu lập lúc mất mạng chưa lên server. Lỗi = server từ chối (VD hết lô còn hạn) → xử lý xong
 * bấm gửi lại; chỉ xóa khi chắc chắn phiếu không còn giá trị.
 */
export function PosSyncDialog({ queue, online, onSyncAll, onRetry, onRemove, onClose }: Props) {
  const [kind, setKind] = useState("");
  const [desc, setDesc] = useState(true);
  const rows = queue.filter((q) => !kind || (q.kind ?? "INVOICE") === kind)
    .sort((a, b) => (desc ? -1 : 1) * a.createdAt.localeCompare(b.createdAt));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-4 p-6 text-[13px] sm:max-w-[722px]">
        <DialogHeader><DialogTitle className="text-[15px] font-bold">Đồng bộ phiếu</DialogTitle></DialogHeader>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-3">Loại phiếu
            <span className="relative">
              <select aria-label="Loại phiếu" value={kind} onChange={(e) => setKind(e.target.value)}
                className="h-7 appearance-none rounded bg-[#eef0f3] pr-6 pl-1.5 outline-none">
                {KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1.5 right-1 size-4" />
            </span>
          </label>
          <span className="flex items-center gap-2">Trạng thái kết nối:
            {online ? <b className="flex items-center gap-1.5 text-primary">Có Internet <Wifi className="size-4" /></b>
              : <b className="flex items-center gap-1.5 text-destructive">Mất kết nối <WifiOff className="size-4" /></b>}
          </span>
        </div>
        <div className="max-h-[360px] overflow-y-auto border border-[#e5e7eb]">
          <table className="w-full">
            <thead className={POS_TABLE_HEAD}><tr>
              <th>Loại phiếu</th><th>Mã phiếu</th>
              <th><button type="button" className="flex items-center gap-1" onClick={() => setDesc(!desc)}>Thời gian
                <ChevronDown className={`size-4 fill-white ${desc ? "" : "rotate-180"}`} /></button></th>
              <th className="text-right">Giá trị</th><th className="w-20" />
            </tr></thead>
            <tbody>
              {!rows.length && <PosTableEmpty colSpan={5} />}
              {rows.map((q) => (
                <tr key={q.id} className="border-b border-[#eef0f3] align-top [&_td]:px-2.5 [&_td]:py-2">
                  <td>{kindLabel(q.kind)}</td>
                  <td>{q.label ?? "—"}<span className="block text-xs text-muted-foreground">{q.customerName}</span>
                    {q.status === "error" ? <span className="block text-xs text-destructive">Lỗi: {q.error}</span>
                      : <span className="block text-xs text-orange-600">Chờ đồng bộ</span>}</td>
                  <td>{formatDateTime(q.createdAt)}</td>
                  <td className="text-right">{formatMoney(q.total)}</td>
                  <td className="text-right whitespace-nowrap">
                    <button type="button" title="Gửi lại" aria-label="Gửi lại" className="p-1 text-[#4b5563] hover:text-primary" onClick={() => onRetry(q.id)}>
                      <RefreshCw className="size-4" /></button>
                    {q.status === "error" && <button type="button" title="Xóa khỏi máy" aria-label="Xóa khỏi máy" className="p-1 text-destructive"
                      onClick={() => confirm("Xóa phiếu này khỏi máy? Phiếu sẽ KHÔNG được ghi nhận.") && onRemove(q.id)}>
                      <Trash2 className="size-4" /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end">
          <Button className="h-9 rounded-md px-4 font-bold" disabled={!queue.length || !online} onClick={onSyncAll}>Đồng bộ tất cả</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
