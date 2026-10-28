"use client";

import { RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDateTime, formatMoney } from "@/lib/format";
import type { QueuedInvoice } from "./pos-types";

type Props = { queue: QueuedInvoice[]; onRetry: (id: string) => void; onRemove: (id: string) => void; onClose: () => void };

/**
 * Hóa đơn bán lúc mất mạng chưa lên server. "Lỗi" = server từ chối (VD hết lô còn hạn):
 * xử lý xong (nhập kho...) thì bấm Gửi lại; chỉ xóa khi chắc chắn hóa đơn không còn giá trị.
 */
export function PosQueueDialog({ queue, onRetry, onRemove, onClose }: Props) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>Hóa đơn chờ đồng bộ ({queue.length})</DialogTitle></DialogHeader>
        {!queue.length && <p className="py-6 text-center text-sm text-muted-foreground">Không còn hóa đơn nào chờ đồng bộ</p>}
        <div className="max-h-96 space-y-2 overflow-y-auto">
          {queue.map((q) => (
            <div key={q.id} className="flex items-start gap-3 rounded-md border p-3 text-sm">
              <div className="flex-1">
                <div className="font-medium">{q.customerName} · {formatMoney(q.total)}</div>
                <div className="text-xs text-muted-foreground">Bán lúc {formatDateTime(q.createdAt)}</div>
                {q.status === "error"
                  ? <div className="mt-1 text-xs text-destructive">Lỗi: {q.error}</div>
                  : <div className="mt-1 text-xs text-orange-600">Đang chờ có mạng để gửi</div>}
              </div>
              <Button size="sm" variant="outline" onClick={() => onRetry(q.id)}><RefreshCw className="size-3.5" /> Gửi lại</Button>
              {q.status === "error" && (
                <Button size="sm" variant="ghost" className="text-destructive"
                  onClick={() => confirm("Xóa hóa đơn này khỏi máy? Hóa đơn sẽ KHÔNG được ghi nhận.") && onRemove(q.id)}>
                  <Trash2 className="size-3.5" /></Button>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
