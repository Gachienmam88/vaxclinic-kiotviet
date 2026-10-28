"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBranches } from "@/features/settings/settings-queries";
import { formatDate, formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { useProductLedger, useProductLots } from "./product-queries";
import { DOC_TYPE_LABEL, type ProductDetail } from "./product-types";

function useBranchName() {
  const { data: branches = [] } = useBranches();
  return (id: string) => branches.find((b) => b.id === id)?.name ?? "—";
}

const Empty = ({ cols, text }: { cols: number; text: string }) => (
  <TableRow><TableCell colSpan={cols} className="py-6 text-center text-muted-foreground">{text}</TableCell></TableRow>
);

/** Thẻ kho: lịch sử biến động tồn (mới nhất trước). */
export function LedgerTab({ productId }: { productId: string }) {
  const [page, setPage] = useState(0);
  const { data, isLoading } = useProductLedger(productId, page);
  const branchName = useBranchName();
  const pages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;
  return (
    <div className="space-y-2">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/60">
            <TableHead>Chứng từ</TableHead><TableHead>Thời gian</TableHead><TableHead>Loại giao dịch</TableHead>
            <TableHead>Điểm tiêm</TableHead><TableHead>Lô</TableHead>
            <TableHead className="text-right">Giá GD</TableHead><TableHead className="text-right">Giá vốn</TableHead>
            <TableHead className="text-right">Số lượng</TableHead><TableHead className="text-right">Tồn cuối</TableHead>
            <TableHead>Đối tác</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {!isLoading && !data?.items.length && <Empty cols={10} text="Chưa có giao dịch kho" />}
          {data?.items.map((l) => (
            <TableRow key={l.id}>
              <TableCell className="font-medium text-primary">{l.docCode}</TableCell>
              <TableCell>{formatDateTime(l.occurredAt)}</TableCell>
              <TableCell>{DOC_TYPE_LABEL[l.docType] ?? l.docType}</TableCell>
              <TableCell>{branchName(l.branchId)}</TableCell>
              <TableCell>{l.lotNumber}</TableCell>
              <TableCell className="text-right">{formatNumber(l.unitPrice)}</TableCell>
              <TableCell className="text-right">{formatNumber(l.cost)}</TableCell>
              <TableCell className="text-right">{formatNumber(l.quantity)}</TableCell>
              <TableCell className="text-right">{formatNumber(l.balanceAfter)}</TableCell>
              <TableCell>{l.partnerName}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {pages > 1 && (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Trước</Button>
          <Button size="sm" variant="outline" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Sau</Button>
        </div>
      )}
    </div>
  );
}

/** Tồn kho theo điểm tiêm (+ theo lô nếu hàng quản lý lô). */
export function StockTab({ product }: { product: ProductDetail }) {
  const branchName = useBranchName();
  const { data: lots = [] } = useProductLots(product.id, product.lotManaged);
  const total = product.stocks.reduce((s, b) => s + Number(b.quantity), 0);
  const reserved = product.stocks.reduce((s, b) => s + Number(b.reserved), 0);
  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/60">
            <TableHead>Điểm tiêm</TableHead><TableHead className="text-right">Tồn kho</TableHead>
            <TableHead className="text-right">KH đặt</TableHead><TableHead>Trạng thái</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow className="font-semibold">
            <TableCell /><TableCell className="text-right">{formatNumber(total)}</TableCell>
            <TableCell className="text-right">{formatNumber(reserved)}</TableCell><TableCell />
          </TableRow>
          {product.stocks.map((s) => (
            <TableRow key={s.branchId}>
              <TableCell>{branchName(s.branchId)}</TableCell>
              <TableCell className="text-right">{formatNumber(s.quantity)}</TableCell>
              <TableCell className="text-right">{formatNumber(s.reserved)}</TableCell>
              <TableCell>{product.active ? "Đang kinh doanh" : "Ngừng kinh doanh"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {product.lotManaged && (
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/60">
              <TableHead>Lô</TableHead><TableHead>Hạn sử dụng</TableHead><TableHead>Điểm tiêm</TableHead>
              <TableHead className="text-right">Tồn</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!lots.length && <Empty cols={4} text="Không còn lô nào tồn" />}
            {lots.map((l) => {
              const days = (new Date(l.expiryDate).getTime() - Date.now()) / 86_400_000;
              return (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.lotNumber}</TableCell>
                  <TableCell className={days < 0 ? "text-destructive" : days < 90 ? "text-orange-600" : ""}>
                    {formatDate(l.expiryDate)}{days < 0 ? " (hết hạn)" : days < 90 ? " (cận hạn)" : ""}
                  </TableCell>
                  <TableCell>{branchName(l.branchId)}</TableCell>
                  <TableCell className="text-right">{formatNumber(l.quantity)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

/** Hàng hóa cùng loại = các đơn vị tính (mỗi đơn vị 1 mã hàng); tồn quy đổi từ đơn vị cơ bản. */
export function UnitsTab({ product }: { product: ProductDetail }) {
  const total = product.stocks.reduce((s, b) => s + Number(b.quantity), 0);
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/60">
          <TableHead>Mã hàng</TableHead><TableHead>Đơn vị</TableHead><TableHead>Mã vạch</TableHead>
          <TableHead className="text-right">Quy đổi</TableHead><TableHead className="text-right">Giá bán</TableHead>
          <TableHead className="text-right">Giá vốn</TableHead><TableHead className="text-right">Tồn kho</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {product.units.map((u) => (
          <TableRow key={u.id}>
            <TableCell className="font-medium text-primary">{u.code}</TableCell>
            <TableCell>{u.unitName}{u.base && " (cơ bản)"}</TableCell>
            <TableCell>{u.barcode}</TableCell>
            <TableCell className="text-right">{formatNumber(u.conversionRate)}</TableCell>
            <TableCell className="text-right">{formatMoney(u.price)}</TableCell>
            <TableCell className="text-right">{formatNumber(Number(product.cost) * Number(u.conversionRate))}</TableCell>
            <TableCell className="text-right">{formatNumber(total / Number(u.conversionRate))}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
