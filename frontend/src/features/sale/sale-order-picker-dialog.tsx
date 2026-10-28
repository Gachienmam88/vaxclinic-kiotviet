"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DocCodeLink } from "@/components/ui/doc-code-link";
import { orderStatusLabel, type OrderStatus } from "@/features/orders/order-types";
import { api } from "@/lib/api-client";
import { formatDateTime, formatMoney } from "@/lib/format";
import {
  SALE_TABLE_HEAD, SaleDateRangeCard, SaleFilterCard, SaleFilterInput, SaleTableEmpty, rangeParams, ymdDaysAgo,
} from "./sale-dialog-parts";

type Row = { id: string; code: string; orderedAt: string; customerName: string; total: number; status: OrderStatus; note: string | null };
type Page = { items: Row[]; total: number };
const FILTERS = [["code", "Theo mã đặt hàng"], ["customer", "Theo khách hàng"], ["note", "Theo ghi chú đặt hàng"],
  ["productCode", "Theo mã hàng"], ["productName", "Theo tên hàng"]] as const;
type Key = (typeof FILTERS)[number][0];

/** Chuỗi tìm kiếm → đợi 300ms sau lần gõ cuối mới gọi API. */
export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

/**
 * "Xử lý đặt hàng": tìm đơn đặt hàng còn xử lý được (Phiếu tạm / Đã xác nhận) của điểm tiêm, mặc định 30 ngày gần nhất.
 * Chọn 1 dòng → mở đơn lên màn bán hàng để tạo hóa đơn (tiền cọc trừ vào khách cần trả). Cần mạng.
 */
export function SaleOrderPickerDialog({ branchId, onPick, onClose }: { branchId: string; onPick: (orderId: string) => void; onClose: () => void }) {
  const [f, setF] = useState<Record<Key, string>>({ code: "", customer: "", note: "", productCode: "", productName: "" });
  const [range, setRange] = useState({ from: ymdDaysAgo(30), to: "" });
  const [page, setPage] = useState(0);
  const q = useDebounced({ ...f, ...range });
  const { data, isFetching, isError } = useQuery({
    queryKey: ["sale-order-search", branchId, q, page],
    queryFn: () => {
      const p = rangeParams(q.from, q.to);
      FILTERS.forEach(([k]) => q[k].trim() && p.set(k, q[k].trim()));
      p.set("branchId", branchId); p.set("page", String(page)); p.set("size", "10");
      return api<Page>(`/orders/sale-search?${p}`);
    },
  });
  const rows = data?.items ?? [];
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / 10));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-4 p-6 text-[13px] sm:max-w-[1035px]">
        <DialogHeader><DialogTitle className="text-[15px] font-bold">Xử lý đặt hàng</DialogTitle></DialogHeader>
        <div className="grid grid-cols-[168px_1fr] items-start gap-7">
          <div className="space-y-5">
            <SaleFilterCard title="Tìm kiếm">
              {FILTERS.map(([k, label], i) => <SaleFilterInput key={k} autoFocus={i === 0} placeholder={label} value={f[k]}
                onChange={(v) => { setF({ ...f, [k]: v }); setPage(0); }} />)}
            </SaleFilterCard>
            <SaleDateRangeCard from={range.from} to={range.to} onChange={(from, to) => { setRange({ from, to }); setPage(0); }} />
          </div>
          <div className="overflow-hidden rounded-sm border border-[#e5e7eb]">
            <table className="w-full">
              <thead className={SALE_TABLE_HEAD}><tr>
                <th>Mã đặt hàng</th><th>Thời gian</th><th>Khách hàng</th><th className="text-right">Tổng cộng</th><th>Trạng thái</th><th>Ghi chú</th>
              </tr></thead>
              <tbody>
                {!rows.length && <SaleTableEmpty colSpan={6} text={isError ? "Mất kết nối: xử lý đặt hàng cần có mạng" : isFetching ? "Đang tải..." : undefined} />}
                {rows.map((r) => (
                  <tr key={r.id} className="cursor-pointer border-b border-[#eef0f3] hover:bg-primary-tint [&_td]:h-9 [&_td]:px-2.5"
                    onClick={() => { onPick(r.id); onClose(); }}>
                    <td><DocCodeLink code={r.code} newTab /></td><td>{formatDateTime(r.orderedAt)}</td><td>{r.customerName}</td>
                    <td className="text-right">{formatMoney(r.total)}</td><td>{orderStatusLabel(r.status)}</td>
                    <td className="max-w-40 truncate" title={r.note ?? ""}>{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pages > 1 && (
              <div className="flex items-center justify-end gap-2 p-2.5">
                <button type="button" disabled={page === 0} className="px-2 disabled:opacity-40" onClick={() => setPage(page - 1)}>‹</button>
                <span>{page + 1} / {pages}</span>
                <button type="button" disabled={page + 1 >= pages} className="px-2 disabled:opacity-40" onClick={() => setPage(page + 1)}>›</button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
