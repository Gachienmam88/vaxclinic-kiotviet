"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DocCodeLink } from "@/components/ui/doc-code-link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ListEmptyRow } from "@/components/ui/list-empty-state";
import { useBranches } from "@/features/settings/settings-queries";
import { formatDate, formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { useProductLedger, useProductLots } from "./product-queries";
import { SUB_TABLE_HEAD_ROW } from "./product-tab-styles";
import { DOC_TYPE_LABEL, type ProductDetail } from "./product-types";

function useBranchList() {
  const { data: branches = [] } = useBranches();
  return { count: branches.length, name: (id: string) => branches.find((b) => b.id === id)?.name ?? "—" };
}

const sum = (xs: number[]) => xs.reduce((s, x) => s + Number(x), 0);

/** Thẻ kho: lịch sử biến động tồn (mới nhất trước). Cột điểm tiêm / lô chỉ hiện khi có dữ liệu tương ứng. */
export function LedgerTab({ productId }: { productId: string }) {
  const [page, setPage] = useState(0);
  const { data, isLoading } = useProductLedger(productId, page);
  const branches = useBranchList();
  const pages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;
  const showBranch = branches.count > 1;
  const showLot = !!data?.items.some((l) => l.lotNumber);
  const cols = 8 + Number(showBranch) + Number(showLot);
  return (
    <div className="space-y-2">
      <Table>
        <TableHeader>
          <TableRow className={SUB_TABLE_HEAD_ROW}>
            <TableHead>Chứng từ</TableHead><TableHead>Thời gian</TableHead><TableHead>Loại giao dịch</TableHead>
            {showBranch && <TableHead>Chi nhánh</TableHead>}
            {showLot && <TableHead>Lô</TableHead>}
            <TableHead className="text-right">Giá GD</TableHead><TableHead className="text-right">Giá vốn</TableHead>
            <TableHead className="text-right">Số lượng</TableHead><TableHead className="text-right">Tồn cuối</TableHead>
            <TableHead>Đối tác</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {!isLoading && !data?.items.length && <ListEmptyRow cols={cols} what="giao dịch" compact />}
          {data?.items.map((l) => (
            <TableRow key={l.id} className="align-top [&>td]:py-3">
              <TableCell><DocCodeLink code={l.docCode} /></TableCell>
              <TableCell>{formatDateTime(l.occurredAt)}</TableCell>
              <TableCell>{DOC_TYPE_LABEL[l.docType] ?? l.docType}</TableCell>
              {showBranch && <TableCell>{branches.name(l.branchId)}</TableCell>}
              {showLot && <TableCell>{l.lotNumber}</TableCell>}
              <TableCell className="text-right">{formatNumber(l.unitPrice)}</TableCell>
              <TableCell className="text-right">{formatNumber(l.cost)}</TableCell>
              <TableCell className="text-right">{formatNumber(l.quantity)}</TableCell>
              <TableCell className="text-right">{formatNumber(l.balanceAfter)}</TableCell>
              <TableCell className="max-w-36 whitespace-normal">{l.partnerName}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {pages > 1 && (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" className="rounded-md" disabled={page === 0} onClick={() => setPage(page - 1)}>Trước</Button>
          <Button size="sm" variant="outline" className="rounded-md" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Sau</Button>
        </div>
      )}
    </div>
  );
}

/** Tồn kho theo điểm tiêm (+ theo lô nếu hàng quản lý lô). */
export function StockTab({ product }: { product: ProductDetail }) {
  const branches = useBranchList();
  const { data: lots = [] } = useProductLots(product.id, product.lotManaged);
  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow className={SUB_TABLE_HEAD_ROW}>
            <TableHead>Chi nhánh</TableHead><TableHead className="text-right">Tồn kho</TableHead>
            <TableHead className="text-right">KH đặt</TableHead><TableHead className="w-48 pl-4">Trạng thái</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow className="hover:bg-transparent">
            <TableCell /><TableCell className="text-right">{formatNumber(sum(product.stocks.map((s) => s.quantity)))}</TableCell>
            <TableCell className="text-right">{formatNumber(sum(product.stocks.map((s) => s.reserved)))}</TableCell><TableCell />
          </TableRow>
          {product.stocks.map((s) => (
            <TableRow key={s.branchId}>
              <TableCell>{branches.name(s.branchId)}</TableCell>
              <TableCell className="text-right">{formatNumber(s.quantity)}</TableCell>
              <TableCell className="text-right">{formatNumber(s.reserved)}</TableCell>
              <TableCell className="pl-4">
                <span className="rounded bg-[#eff0f3] px-1.5 py-0.5 text-xs">{product.active ? "Đang kinh doanh" : "Ngừng kinh doanh"}</span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {product.lotManaged && (
        <Table>
          <TableHeader>
            <TableRow className={SUB_TABLE_HEAD_ROW}>
              <TableHead>Lô</TableHead><TableHead>Hạn sử dụng</TableHead><TableHead>Chi nhánh</TableHead>
              <TableHead className="text-right">Tồn</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!lots.length && <ListEmptyRow cols={4} what="lô hàng" compact />}
            {lots.map((l) => {
              const days = (new Date(l.expiryDate).getTime() - Date.now()) / 86_400_000;
              return (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.lotNumber}</TableCell>
                  <TableCell className={days < 0 ? "text-destructive" : days < 90 ? "text-orange-600" : ""}>
                    {formatDate(l.expiryDate)}{days < 0 ? " (hết hạn)" : days < 90 ? " (cận hạn)" : ""}
                  </TableCell>
                  <TableCell>{branches.name(l.branchId)}</TableCell>
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

/** Hàng hóa cùng loại = các đơn vị tính (mỗi đơn vị 1 mã hàng); tồn / khách đặt quy đổi từ đơn vị cơ bản. */
export function UnitsTab({ product }: { product: ProductDetail }) {
  const total = sum(product.stocks.map((s) => s.quantity));
  const reserved = sum(product.stocks.map((s) => s.reserved));
  const baseUnit = product.units.find((u) => u.base)?.unitName;
  return (
    <Table>
      <TableHeader>
        <TableRow className={SUB_TABLE_HEAD_ROW}>
          <TableHead>Mã hàng</TableHead><TableHead>Tên hàng</TableHead><TableHead>Tên hàng trên hóa đơn điện tử</TableHead>
          <TableHead className="text-right">Giá bán</TableHead><TableHead className="text-right">VAT hàng bán (%)</TableHead>
          <TableHead>Áp dụng giảm thuế</TableHead><TableHead className="text-right">Giá vốn</TableHead>
          <TableHead className="text-right">Tồn kho</TableHead><TableHead className="text-right">Khách đặt</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={7} />
          <TableCell className="text-right">{formatNumber(total)}</TableCell>
          <TableCell className="text-right">{formatNumber(reserved)}</TableCell>
        </TableRow>
        {product.units.map((u) => {
          const rate = Number(u.conversionRate);
          return (
            <TableRow key={u.id} className="align-top [&>td]:py-3">
              <TableCell className="text-primary">{u.code}</TableCell>
              <TableCell className="max-w-48 min-w-36 whitespace-normal">
                {product.name} ({u.unitName})
                {!u.base && <span className="text-muted-foreground"> = {formatNumber(rate)} {baseUnit}</span>}
                {u.barcode && <div className="text-xs text-muted-foreground">Mã vạch: {u.barcode}</div>}
              </TableCell>
              <TableCell className="max-w-48 whitespace-normal">{product.einvoiceName}</TableCell>
              <TableCell className="text-right">{formatMoney(u.price)}</TableCell>
              <TableCell className="max-w-36 text-right whitespace-normal">{product.taxRateName}</TableCell>
              <TableCell>{product.taxReduction ? "Có áp dụng" : "Không áp dụng"}</TableCell>
              <TableCell className="text-right">{formatNumber(Number(product.cost) * rate)}</TableCell>
              <TableCell className="text-right">{formatNumber(total / rate)}</TableCell>
              <TableCell className="text-right">{formatNumber(reserved / rate)}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
