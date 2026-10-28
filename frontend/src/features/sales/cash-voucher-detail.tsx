"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { NotebookPen, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DocCodeLink } from "@/components/ui/doc-code-link";
import { DetailTabsList } from "@/components/ui/detail-tabs-list";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { api, errorMessage } from "@/lib/api-client";
import { formatDateTime, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DETAIL_BTN, DETAIL_PANEL, DETAIL_TAB, DETAIL_TABS_LIST, StatusBadge, SUB_HEAD } from "./invoice-list-kit";
import { SALES_KEYS } from "./sales-queries";
import { FUND_LABEL } from "./sales-types";
import { voucherData } from "@/features/print/print-data";
import { PrintButton } from "@/features/print/print-button";

type Voucher = {
  id: string; code: string; voucherType: string; fund: string; category: string; amount: number; occurredAt: string;
  partnerType: string; partnerName: string | null; partnerPhone: string | null; collectorName: string | null;
  createdByName: string | null; accounting: boolean; status: string; sourceType: string; note: string | null;
};
type Detail = { voucher: Voucher; allocations: { invoiceId: string; invoiceCode: string; soldAt: string; invoiceTotal: number; amount: number }[] };

/** Phiếu tự sinh = "PC"/"PT"/"TT" + mã chứng từ gốc (+ "-n" khi nhiều phiếu): PCPN000001 → PN000001, TTHD000123-2 → HD000123. */
const sourceDocCode = (code: string) => /^(?:PC|PT|TT)((?:THN|PN|TH|HD|DH|DS)\d+)/.exec(code)?.[1] ?? null;

const PARTNER = { CUSTOMER: "Khách hàng", SUPPLIER: "Nhà cung cấp", EMPLOYEE: "Nhân viên", OTHER: "Khác",
  DELIVERY_PARTNER: "Đối tác giao hàng" } as Record<string, string>;

/** Chi tiết phiếu thu/chi mở dưới dòng Sổ quỹ. */
export function CashVoucherDetail({ id, onClose }: { id: string; onClose?: () => void }) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["cash-voucher", id], queryFn: () => api<Detail>(`/cashbook/${id}`) });
  const cancel = useMutation({
    mutationFn: () => api(`/cashbook/${id}/cancel`, { method: "POST" }),
    onSuccess: () => { toast.success("Đã hủy phiếu"); [...SALES_KEYS, ["cash-voucher"]].forEach((k) => qc.invalidateQueries({ queryKey: k })); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (!data) return <div className={cn(DETAIL_PANEL, "p-6 text-muted-foreground")}>Đang tải...</div>;
  const v = data.voucher;
  const source = sourceDocCode(v.code);
  const receipt = v.voucherType === "RECEIPT";
  const auto = v.sourceType === "INVOICE" || v.sourceType === "PURCHASE" || v.sourceType === "DELIVERY";
  const fields = [["Số tiền", formatMoney(v.amount)], [`Loại ${receipt ? "thu" : "chi"}`, v.category],
    [`Đối tượng ${receipt ? "nộp" : "nhận"}`, PARTNER[v.partnerType]], ["Phương thức thanh toán", FUND_LABEL[v.fund]]] as const;
  return (
    <div className={DETAIL_PANEL}>
      <Tabs defaultValue="info" className="gap-0">
        <DetailTabsList onActiveTabClick={onClose} variant="line" className={DETAIL_TABS_LIST}><TabsTrigger value="info" className={DETAIL_TAB}>Thông tin</TabsTrigger></DetailTabsList>
        <TabsContent value="info">
          <div className="space-y-5 p-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base font-bold">{receipt ? "Phiếu thu" : "Phiếu chi"}</span><span>{v.code}</span>
                <StatusBadge tone={v.status === "PAID" ? "green" : "red"}>{v.status === "PAID" ? "Đã thanh toán" : "Đã hủy"}</StatusBadge>
                <StatusBadge tone={v.accounting ? "blue" : "red"}>{v.accounting ? "Hạch toán" : "Không hạch toán"}</StatusBadge>
              </div>
              <p className="flex flex-wrap gap-x-3 divide-x text-xs [&>span]:pr-3">
                <span>Người tạo: {v.createdByName}</span><span>{receipt ? "Người thu" : "Người chi"}: {v.collectorName}</span>
                <span>Thời gian: {formatDateTime(v.occurredAt)}</span>
                {source && <span>Chứng từ gốc: <DocCodeLink code={source} /></span>}</p>
            </div>
            <div className="grid grid-cols-2 gap-x-5 gap-y-4 md:grid-cols-4">
              {fields.map(([k, val]) => (
                <div key={k} className="space-y-2 border-b pb-2"><div className="text-xs text-muted-foreground">{k}</div><div>{val}</div></div>))}
            </div>
            <div className="space-y-2"><div className="text-xs text-muted-foreground">Người {receipt ? "nộp" : "nhận"}</div>
              <div><span className="text-primary">{v.partnerName ?? "—"}</span>{v.partnerPhone && `, ${v.partnerPhone}`}</div></div>
            {data.allocations.length > 0 && (
              <div className="rounded-lg border p-3">
                <p className="mb-2.5">{receipt ? "Phiếu thu" : "Phiếu chi"}{auto && " tự động"} được gắn với hóa đơn{" "}
                  {data.allocations.map((a, i) => <span key={a.invoiceId}>{i > 0 && ", "}<DocCodeLink code={a.invoiceCode} kind="/invoices" /></span>)}</p>
                <table className="w-full">
                  <thead className={SUB_HEAD}><tr><th className="pl-2.5">Mã phiếu</th><th>Thời gian</th>
                    <th className="text-right">Giá trị phiếu</th><th className="pr-2.5 text-right">Giá trị thu</th></tr></thead>
                  <tbody>{data.allocations.map((a) => (
                    <tr key={a.invoiceId} className="[&_td]:px-2 [&_td]:py-2.5"><td><DocCodeLink code={a.invoiceCode} kind="/invoices" /></td><td>{formatDateTime(a.soldAt)}</td>
                      <td className="text-right">{formatMoney(a.invoiceTotal)}</td><td className="text-right">{formatMoney(a.amount)}</td></tr>))}</tbody>
                </table>
              </div>
            )}
            <p className="flex items-center gap-2"><NotebookPen className="size-4 text-muted-foreground" />{v.note || "Chưa có ghi chú"}</p>
          </div>
          {v.status === "PAID" && (
            <div className="flex flex-wrap items-center gap-2 border-t px-4 py-2.5">
              {auto
                ? <p className="text-xs text-muted-foreground">Phiếu tự động — muốn hủy hãy hủy {v.sourceType === "INVOICE" ? "hóa đơn" : v.sourceType === "DELIVERY" ? "phiếu đối soát ở Đối tác giao hàng" : "phiếu nhập"} gốc.</p>
                : <Button variant="ghost" className={DETAIL_BTN} disabled={cancel.isPending}
                    onClick={() => confirm(`Hủy phiếu ${v.code}?`) && cancel.mutate()}><Trash2 className="size-4" /> Hủy</Button>}
              <span className="ml-auto"><PrintButton type={v.voucherType === "RECEIPT" ? "CASH_RECEIPT" : "CASH_PAYMENT"} data={voucherData(v)} /></span>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
