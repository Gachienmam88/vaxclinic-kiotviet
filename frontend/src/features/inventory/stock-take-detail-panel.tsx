"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DocCodeLink } from "@/components/ui/doc-code-link";
import { api, errorMessage } from "@/lib/api-client";
import { formatDate, formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { useCurrentUser } from "@/lib/use-current-user";
import { exportStockTakeLinesCsv } from "./inventory-csv-export";
import { Info, InventoryDetailActions, InventoryDetailFrame } from "./inventory-detail-chrome";
import { useStockTake } from "./inventory-queries";
import { TAKE_STATUS_LABEL } from "./inventory-types";

const CELL = "px-2 py-2.5";

/** Chi tiết phiếu kiểm kho dưới dòng: thông tin, bảng dòng kiểm (theo lô), tổng lệch. Chỉ phiếu tạm mới hủy/mở lại được. */
export function StockTakeDetailPanel({ id, onClose }: { id: string; onClose?: () => void }) {
  const qc = useQueryClient();
  const { can } = useCurrentUser();
  const { data: t } = useStockTake(id);
  const cancel = useMutation({
    mutationFn: () => api(`/stock-takes/${id}/cancel`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Đã hủy phiếu kiểm kho");
      qc.invalidateQueries({ queryKey: ["stock-takes"] });
      qc.invalidateQueries({ queryKey: ["stock-take", id] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (!t) return <div className="border border-primary bg-background p-6 text-sm text-muted-foreground">Đang tải...</div>;

  const rows: [string, string][] = [
    ["Tổng SL thực tế", formatNumber(t.actualQuantity)], ["Tổng thực tế", formatMoney(t.actualValue)],
    ["SL lệch tăng", formatNumber(t.increaseQuantity)], ["SL lệch giảm", formatNumber(t.decreaseQuantity)],
    ["Tổng chênh lệch", formatMoney(t.diffValue)],
  ];
  const draft = t.status === "DRAFT";
  return (
    <InventoryDetailFrame code={t.code} status={t.status} statusLabel={TAKE_STATUS_LABEL[t.status]} branchId={t.branchId} onClose={onClose}
      footer={t.status !== "CANCELLED" && (
        <InventoryDetailActions canManage={can("inventory.manage")} canCancel={draft} cancelling={cancel.isPending}
          cancelText={`Hủy phiếu kiểm kho ${t.code}?`} onCancel={() => cancel.mutate()}
          editHref={draft ? `/inventory/stock-takes/new?edit=${t.id}` : undefined} onExport={() => exportStockTakeLinesCsv(t)} />
      )}>
      <div className="grid grid-cols-1 gap-x-8 gap-y-1.5 md:grid-cols-3">
        <Info label="Người tạo">{t.createdByName}</Info>
        <Info label="Thời gian">{formatDateTime(t.takenAt)}</Info>
        <Info label="Ngày cân bằng">{formatDateTime(t.balancedAt) || "—"}</Info>
      </div>
      <table className="w-full">
        <thead className="bg-[#eff0f3] text-left text-xs font-bold"><tr className="h-[30px]">
          <th className="px-2">Mã hàng</th><th className="px-2">Tên hàng</th><th className="px-2">Lô / HSD</th>
          <th className="px-2 text-right">Tồn kho</th><th className="px-2 text-right">Thực tế</th>
          <th className="px-2 text-right">SL lệch</th><th className="px-2 text-right">Giá trị lệch</th>
        </tr></thead>
        <tbody>
          {t.lines.map((l) => (
            <tr key={l.id} className="border-b border-[#e5e7eb] align-top hover:bg-[#edeef0]">
              <td className={CELL}><DocCodeLink code={l.productCode} /></td>
              <td className={`${CELL} max-w-[260px]`}>{l.productName} ({l.unitName})</td>
              <td className={CELL}>{l.lotNumber ? `${l.lotNumber} — ${formatDate(l.expiryDate)}` : ""}</td>
              <td className={`${CELL} text-right`}>{formatNumber(l.systemQuantity)}</td>
              <td className={`${CELL} text-right`}>{l.actualQuantity == null ? "Chưa kiểm" : formatNumber(l.actualQuantity)}</td>
              <td className={`${CELL} text-right`}>{formatNumber(l.diffQuantity)}</td>
              <td className={`${CELL} text-right font-bold`}>{formatMoney(l.diffValue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-start gap-6">
        <p className="max-w-[720px] whitespace-pre-wrap text-muted-foreground">{t.note}</p>
        <dl className="ml-auto grid w-[300px] shrink-0 grid-cols-[1fr_110px] gap-y-2.5">
          {rows.map(([k, v]) => <div key={k} className="contents"><dt className="text-right">{k}</dt><dd className="text-right">{v}</dd></div>)}
        </dl>
      </div>
    </InventoryDetailFrame>
  );
}
