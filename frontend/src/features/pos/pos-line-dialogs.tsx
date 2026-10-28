"use client";

import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ProductDetail } from "@/features/products/product-types";
import { api } from "@/lib/api-client";
import { formatDate, formatDateTime, formatMoney, formatNumber } from "@/lib/format";

type RecentPrice = { invoiceCode: string; soldAt: string; customerName: string; quantity: number; price: number };

/** "Xem giá bán gần nhất": 10 lần bán gần nhất (ưu tiên cho đúng khách) → chọn 1 dòng để áp dụng giá. */
export function RecentPriceDialog({ productId, productName, customerId, onApply, onClose }: {
  productId: string; productName: string; customerId: string | null; onApply: (price: number) => void; onClose: () => void;
}) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["recent-prices", productId, customerId],
    queryFn: () => api<RecentPrice[]>(`/invoices/recent-prices?productId=${productId}${customerId ? `&customerId=${customerId}` : ""}`),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader><DialogTitle>{productName}</DialogTitle></DialogHeader>
        <table className="w-full text-sm">
          <thead className="bg-primary text-left text-primary-foreground"><tr><th className="px-2 py-2">Mã phiếu</th>
            <th className="px-2">Thời gian</th><th className="px-2">Khách</th><th className="px-2 text-right">Số lượng</th>
            <th className="px-2 text-right">Giá bán</th></tr></thead>
          <tbody>
            {!isLoading && !data.length && <tr><td colSpan={5} className="py-10 text-center text-muted-foreground">Chưa có dữ liệu</td></tr>}
            {data.map((r) => (
              <tr key={r.invoiceCode} className="cursor-pointer border-b hover:bg-primary/5" onClick={() => { onApply(Number(r.price)); onClose(); }}>
                <td className="px-2 py-2 text-primary">{r.invoiceCode}</td><td className="px-2">{formatDateTime(r.soldAt)}</td>
                <td className="px-2">{r.customerName}</td><td className="px-2 text-right">{formatNumber(r.quantity)}</td>
                <td className="px-2 text-right font-semibold">{formatMoney(r.price)}</td>
              </tr>))}
          </tbody>
        </table>
        <p className="text-xs text-muted-foreground">Bấm vào 1 dòng để áp dụng giá bán đó.</p>
        <DialogFooter><Button variant="outline" onClick={onClose}>Bỏ qua</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** "Xem chi tiết": giá bán, tồn, vị trí, lô còn hạn — để thu ngân tư vấn nhanh. */
export function ProductInfoDialog({ productId, onClose }: { productId: string; onClose: () => void }) {
  const { data: p } = useQuery({ queryKey: ["product", productId], queryFn: () => api<ProductDetail>(`/products/${productId}`) });
  const { data: lots = [] } = useQuery({
    queryKey: ["product-lots", productId], enabled: !!p?.lotManaged,
    queryFn: () => api<{ id: string; lotNumber: string; expiryDate: string; quantity: number }[]>(`/products/${productId}/lots`),
  });
  const stock = p?.stocks.reduce((s, b) => s + Number(b.quantity), 0) ?? 0;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{p?.name ?? "..."}</DialogTitle></DialogHeader>
        {p && (
          <div className="space-y-2 text-sm">
            {([["Giá bán", p.units.map((u) => `${formatMoney(u.price)} / ${u.unitName}`).join(" · ")], ["Tồn kho", formatNumber(stock)],
              ["Nhóm hàng", p.categoryName], ["Vị trí", p.positionName], ["Tỷ lệ thuế", p.taxRateName]] as const).map(([k, v]) => (
              <div key={k} className="flex border-b border-dashed pb-1.5"><span className="w-28 text-muted-foreground">{k}:</span><span>{v || "—"}</span></div>))}
            {p.lotManaged && (
              <div><span className="text-muted-foreground">Lô còn hàng (hết hạn trước bán trước):</span>
                {lots.map((l) => <div key={l.id} className="ml-2">• {l.lotNumber} — HSD {formatDate(l.expiryDate)} — tồn {formatNumber(l.quantity)}</div>)}
              </div>)}
            {p.description && <p className="whitespace-pre-wrap text-muted-foreground">{p.description}</p>}
          </div>
        )}
        <DialogFooter><Button onClick={onClose}>Xong</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
