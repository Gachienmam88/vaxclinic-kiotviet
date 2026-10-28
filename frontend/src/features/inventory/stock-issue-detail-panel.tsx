"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DocCodeLink } from "@/components/ui/doc-code-link";
import { api, errorMessage } from "@/lib/api-client";
import { formatDate, formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { useCurrentUser } from "@/lib/use-current-user";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { inventoryNs } from "@/messages/inventory";
import { exportStockIssueLinesCsv } from "./inventory-csv-export";
import { Info, InventoryDetailActions, InventoryDetailFrame } from "./inventory-detail-chrome";
import { useStockIssue } from "./inventory-queries";
import { ISSUE_CONFIG, ISSUE_STATUS_KEY, type IssueType } from "./inventory-types";

const CELL = "px-2 py-2.5";

/** Chi tiết phiếu xuất hủy / xuất dùng nội bộ dưới dòng. Hủy phiếu đã hoàn thành = nhập lại kho. */
export function StockIssueDetailPanel({ type, id, onClose }: { type: IssueType; id: string; onClose?: () => void }) {
  const cfg = ISSUE_CONFIG[type];
  const t = useT(inventoryNs);
  const tc = useT(commonNs);
  const qc = useQueryClient();
  const { can } = useCurrentUser();
  const { data: d } = useStockIssue(type, id);
  const cancel = useMutation({
    mutationFn: () => api(`/stock-issues/${id}/cancel?type=${type}`, { method: "POST" }),
    onSuccess: () => {
      toast.success(t(`issue.${cfg.msg}.cancelled`));
      qc.invalidateQueries({ queryKey: ["stock-issues", type] });
      qc.invalidateQueries({ queryKey: ["stock-issue", id] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (!d) return <div className="border border-primary bg-background p-6 text-sm text-muted-foreground">{tc("status.loading")}</div>;

  return (
    <InventoryDetailFrame code={d.code} status={d.status} statusLabel={t(ISSUE_STATUS_KEY[d.status])} branchId={d.branchId} onClose={onClose}
      footer={d.status !== "CANCELLED" && (
        <InventoryDetailActions canManage={can("inventory.manage")} canCancel cancelling={cancel.isPending}
          cancelText={t(d.status === "COMPLETED" ? "detail.confirmCancelRestock" : "detail.confirmCancel", { code: d.code })}
          onCancel={() => cancel.mutate()} onExport={() => exportStockIssueLinesCsv(t, d)}
          editHref={d.status === "DRAFT" ? `${cfg.listPath}/new?edit=${d.id}` : undefined} />
      )}>
      <div className="grid grid-cols-1 gap-x-8 gap-y-1.5 md:grid-cols-3">
        <Info label={t("fields.createdBy")}>{d.createdByName}</Info>
        <Info label={t("fields.time")}>{formatDateTime(d.issuedAt)}</Info>
        <Info label={t("fields.reason")}>{d.reason ?? "—"}</Info>
      </div>
      <table className="w-full">
        <thead className="bg-[#eff0f3] text-left text-xs font-bold"><tr className="h-[30px]">
          <th className="px-2">{t("fields.productCode")}</th><th className="px-2">{t("fields.productName")}</th><th className="px-2">{t("fields.lotExpiry")}</th>
          <th className="px-2 text-right">{t(`issue.${cfg.msg}.qtyLabel`)}</th><th className="px-2 text-right">{t("fields.cost")}</th>
          <th className="px-2 text-right">{t(`issue.${cfg.msg}.lineValueLabel`)}</th>
        </tr></thead>
        <tbody>
          {d.lines.map((l) => (
            <tr key={l.id} className="border-b border-[#e5e7eb] align-top hover:bg-[#edeef0]">
              <td className={CELL}><DocCodeLink code={l.productCode} /></td>
              <td className={`${CELL} max-w-[260px]`}>{l.productName} ({l.unitName})</td>
              <td className={CELL}>{l.lotNumber ? `${l.lotNumber} — ${formatDate(l.expiryDate)}` : ""}</td>
              <td className={`${CELL} text-right`}>{formatNumber(l.quantity)}</td>
              <td className={`${CELL} text-right`}>{formatMoney(l.unitCost)}</td>
              <td className={`${CELL} text-right font-bold`}>{formatMoney(l.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-start gap-6">
        <p className="max-w-[720px] whitespace-pre-wrap text-muted-foreground">{d.note}</p>
        <dl className="ml-auto grid w-[300px] shrink-0 grid-cols-[1fr_110px] gap-y-2.5">
          <dt className="text-right">{t("fields.totalQty")}</dt><dd className="text-right">{formatNumber(d.totalQuantity)}</dd>
          <dt className="text-right">{t(`issue.${cfg.msg}.valueLabel`)}</dt><dd className="text-right font-bold">{formatMoney(d.totalValue)}</dd>
        </dl>
      </div>
    </InventoryDetailFrame>
  );
}
