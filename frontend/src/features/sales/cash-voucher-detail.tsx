"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, errorMessage } from "@/lib/api-client";
import { formatDateTime, formatMoney } from "@/lib/format";
import { SALES_KEYS } from "./sales-queries";
import { FUND_LABEL } from "./sales-types";

type Voucher = {
  id: string; code: string; voucherType: string; fund: string; category: string; amount: number; occurredAt: string;
  partnerType: string; partnerName: string | null; partnerPhone: string | null; collectorName: string | null;
  createdByName: string | null; accounting: boolean; status: string; sourceType: string; note: string | null;
};
type Detail = { voucher: Voucher; allocations: { invoiceId: string; invoiceCode: string; soldAt: string; invoiceTotal: number; amount: number }[] };

const PARTNER = { CUSTOMER: "Khách hàng", SUPPLIER: "Nhà cung cấp", EMPLOYEE: "Nhân viên", OTHER: "Khác" } as Record<string, string>;

/** Chi tiết phiếu thu/chi mở dưới dòng Sổ quỹ. */
export function CashVoucherDetail({ id }: { id: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["cash-voucher", id], queryFn: () => api<Detail>(`/cashbook/${id}`) });
  const cancel = useMutation({
    mutationFn: () => api(`/cashbook/${id}/cancel`, { method: "POST" }),
    onSuccess: () => { toast.success("Đã hủy phiếu"); [...SALES_KEYS, ["cash-voucher"]].forEach((k) => qc.invalidateQueries({ queryKey: k })); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (!data) return <div className="p-6 text-sm text-muted-foreground">Đang tải...</div>;
  const v = data.voucher;
  const receipt = v.voucherType === "RECEIPT";
  const auto = v.sourceType === "INVOICE" || v.sourceType === "PURCHASE";
  return (
    <div className="space-y-4 border-x-2 border-b-2 border-primary/40 bg-background p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-lg font-bold">{receipt ? "Phiếu thu" : "Phiếu chi"} {v.code}</span>
        <Badge variant={v.status === "PAID" ? "default" : "destructive"}>{v.status === "PAID" ? "Đã thanh toán" : "Đã hủy"}</Badge>
        <Badge variant="outline" className={v.accounting ? "" : "text-destructive"}>{v.accounting ? "Hạch toán" : "Không hạch toán"}</Badge>
      </div>
      <p className="text-muted-foreground">Người tạo: {v.createdByName} | {receipt ? "Người thu" : "Người chi"}: {v.collectorName} | Thời gian: {formatDateTime(v.occurredAt)}</p>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div><div className="text-xs text-muted-foreground">Số tiền</div><b>{formatMoney(v.amount)}</b></div>
        <div><div className="text-xs text-muted-foreground">Loại {receipt ? "thu" : "chi"}</div>{v.category}</div>
        <div><div className="text-xs text-muted-foreground">Đối tượng</div>{PARTNER[v.partnerType]}</div>
        <div><div className="text-xs text-muted-foreground">Quỹ</div>{FUND_LABEL[v.fund]}</div>
      </div>
      <div><div className="text-xs text-muted-foreground">Người {receipt ? "nộp" : "nhận"}</div>
        <span className="text-primary">{v.partnerName ?? "—"}</span>{v.partnerPhone && `, ${v.partnerPhone}`}</div>
      {data.allocations.length > 0 && (
        <div className="rounded-md border">
          <p className="border-b px-3 py-2 font-medium">Phiếu thu được gắn với hóa đơn {data.allocations.map((a) => a.invoiceCode).join(", ")}</p>
          <table className="w-full">
            <thead className="bg-muted/60 text-left"><tr><th className="px-3 py-1.5">Mã phiếu</th><th className="px-3">Thời gian</th>
              <th className="px-3 text-right">Giá trị phiếu</th><th className="px-3 text-right">Giá trị thu</th></tr></thead>
            <tbody>{data.allocations.map((a) => (
              <tr key={a.invoiceId}><td className="px-3 py-1.5 text-primary">{a.invoiceCode}</td><td className="px-3">{formatDateTime(a.soldAt)}</td>
                <td className="px-3 text-right">{formatMoney(a.invoiceTotal)}</td><td className="px-3 text-right">{formatMoney(a.amount)}</td></tr>))}</tbody>
          </table>
        </div>
      )}
      <p className="text-muted-foreground">{v.note || "Chưa có ghi chú"}</p>
      {v.status === "PAID" && (
        <div className="border-t pt-3">
          {auto
            ? <p className="text-xs text-muted-foreground">Phiếu tự động — muốn hủy hãy hủy {v.sourceType === "INVOICE" ? "hóa đơn" : "phiếu nhập"} gốc.</p>
            : <Button variant="ghost" className="text-destructive" disabled={cancel.isPending}
                onClick={() => confirm(`Hủy phiếu ${v.code}?`) && cancel.mutate()}><Trash2 className="size-4" /> Hủy</Button>}
        </div>
      )}
    </div>
  );
}
