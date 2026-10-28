"use client";

import { useState } from "react";
import { ChevronDown, RefreshCw, Trash2, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDateTime, formatMoney } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { saleNs } from "@/messages/sale";
import { SALE_TABLE_HEAD, SaleTableEmpty } from "./sale-dialog-parts";
import type { QueuedInvoice } from "./sale-types";

const KINDS = [["", "sync.kinds.all"], ["INVOICE", "sync.kinds.invoice"], ["RETURN", "sync.kinds.return"], ["ORDER", "sync.kinds.order"]] as const;
const kindKey = (k: QueuedInvoice["kind"]) => KINDS.find(([v]) => v === (k ?? "INVOICE"))?.[1] ?? "sync.kinds.invoice";

type Props = {
  queue: QueuedInvoice[]; online: boolean; onSyncAll: () => void; onRetry: (id: string) => void; onRemove: (id: string) => void;
  onClose: () => void;
};

/**
 * "Đồng bộ phiếu": phiếu lập lúc mất mạng chưa lên server. Lỗi = server từ chối (VD hết lô còn hạn) → xử lý xong
 * bấm gửi lại; chỉ xóa khi chắc chắn phiếu không còn giá trị.
 */
export function SaleSyncDialog({ queue, online, onSyncAll, onRetry, onRemove, onClose }: Props) {
  const t = useT(saleNs);
  const [kind, setKind] = useState("");
  const [desc, setDesc] = useState(true);
  const rows = queue.filter((q) => !kind || (q.kind ?? "INVOICE") === kind)
    .sort((a, b) => (desc ? -1 : 1) * a.createdAt.localeCompare(b.createdAt));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-4 p-6 text-[13px] sm:max-w-[722px]">
        <DialogHeader><DialogTitle className="text-[15px] font-bold">{t("header.sync")}</DialogTitle></DialogHeader>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-3">{t("sync.kind")}
            <span className="relative">
              <select aria-label={t("sync.kind")} value={kind} onChange={(e) => setKind(e.target.value)}
                className="h-7 appearance-none rounded bg-[#eef0f3] pr-6 pl-1.5 outline-none">
                {KINDS.map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1.5 right-1 size-4" />
            </span>
          </label>
          <span className="flex items-center gap-2">{t("sync.connection")}
            {online ? <b className="flex items-center gap-1.5 text-primary">{t("sync.online")} <Wifi className="size-4" /></b>
              : <b className="flex items-center gap-1.5 text-destructive">{t("sync.offline")} <WifiOff className="size-4" /></b>}
          </span>
        </div>
        <div className="max-h-[360px] overflow-y-auto border border-[#e5e7eb]">
          <table className="w-full">
            <thead className={SALE_TABLE_HEAD}><tr>
              <th>{t("sync.kind")}</th><th>{t("sync.code")}</th>
              <th><button type="button" className="flex items-center gap-1" onClick={() => setDesc(!desc)}>{t("dialogs.time")}
                <ChevronDown className={`size-4 fill-white ${desc ? "" : "rotate-180"}`} /></button></th>
              <th className="text-right">{t("sync.value")}</th><th className="w-20" />
            </tr></thead>
            <tbody>
              {!rows.length && <SaleTableEmpty colSpan={5} />}
              {rows.map((q) => (
                <tr key={q.id} className="border-b border-[#eef0f3] align-top [&_td]:px-2.5 [&_td]:py-2">
                  <td>{t(kindKey(q.kind))}</td>
                  <td>{q.label ?? "—"}<span className="block text-xs text-muted-foreground">{q.customerName}</span>
                    {q.status === "error" ? <span className="block text-xs text-destructive">{t("sync.error", { error: q.error ?? "" })}</span>
                      : <span className="block text-xs text-orange-600">{t("sync.pending")}</span>}</td>
                  <td>{formatDateTime(q.createdAt)}</td>
                  <td className="text-right">{formatMoney(q.total)}</td>
                  <td className="text-right whitespace-nowrap">
                    <button type="button" title={t("sync.retry")} aria-label={t("sync.retry")} className="p-1 text-[#4b5563] hover:text-primary" onClick={() => onRetry(q.id)}>
                      <RefreshCw className="size-4" /></button>
                    {q.status === "error" && <button type="button" title={t("sync.remove")} aria-label={t("sync.remove")} className="p-1 text-destructive"
                      onClick={() => confirm(t("sync.confirmRemove")) && onRemove(q.id)}>
                      <Trash2 className="size-4" /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end">
          <Button className="h-9 rounded-md px-4 font-bold" disabled={!queue.length || !online} onClick={onSyncAll}>{t("sync.syncAll")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
