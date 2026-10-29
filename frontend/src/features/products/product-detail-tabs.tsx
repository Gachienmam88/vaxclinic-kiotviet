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
import type { ProductDetail } from "./product-types";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { productsNs } from "@/messages/products";

/** Loại giao dịch thẻ kho đã có nhãn trong namespace products (docTypes.*); loại lạ hiện mã gốc. */
const isDocType = (x: string): x is keyof typeof productsNs.vi.docTypes => x in productsNs.vi.docTypes;

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
  const t = useT(productsNs);
  const tc = useT(commonNs);
  return (
    <div className="space-y-2">
      <Table>
        <TableHeader>
          <TableRow className={SUB_TABLE_HEAD_ROW}>
            <TableHead>{t("ledger.doc")}</TableHead><TableHead>{t("ledger.time")}</TableHead><TableHead>{t("ledger.type")}</TableHead>
            {showBranch && <TableHead>{tc("fields.branch")}</TableHead>}
            {showLot && <TableHead>{t("fields.lot")}</TableHead>}
            <TableHead className="text-right">{t("ledger.txPrice")}</TableHead><TableHead className="text-right">{t("fields.cost")}</TableHead>
            <TableHead className="text-right">{t("fields.quantity")}</TableHead><TableHead className="text-right">{t("ledger.balance")}</TableHead>
            <TableHead>{t("ledger.partner")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {!isLoading && !data?.items.length && <ListEmptyRow cols={cols} compact />}
          {data?.items.map((l) => (
            <TableRow key={l.id} className="align-top [&>td]:py-3">
              <TableCell><DocCodeLink code={l.docCode} /></TableCell>
              <TableCell>{formatDateTime(l.occurredAt)}</TableCell>
              <TableCell>{isDocType(l.docType) ? t(`docTypes.${l.docType}`) : l.docType}</TableCell>
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
          <Button size="sm" variant="outline" className="rounded-md" disabled={page === 0} onClick={() => setPage(page - 1)}>{tc("pager.prev")}</Button>
          <Button size="sm" variant="outline" className="rounded-md" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>{tc("pager.next")}</Button>
        </div>
      )}
    </div>
  );
}

/** Tồn kho theo điểm tiêm: tồn, khách đặt, dự kiến hết hàng của chi nhánh, trạng thái (+ theo lô nếu hàng quản lý lô). */
export function StockTab({ product }: { product: ProductDetail }) {
  const branches = useBranchList();
  const { data: lots = [] } = useProductLots(product.id, product.lotManaged);
  const t = useT(productsNs);
  const tc = useT(commonNs);
  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow className={SUB_TABLE_HEAD_ROW}>
            <TableHead>{tc("fields.branch")}</TableHead><TableHead className="text-right">{t("fields.stock")}</TableHead>
            <TableHead className="text-right">{t("fields.reserved")}</TableHead><TableHead className="pl-4">{t("fields.expectedOut")}</TableHead>
            <TableHead className="w-48 pl-4">{tc("fields.status")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow className="hover:bg-transparent">
            <TableCell /><TableCell className="text-right">{formatNumber(sum(product.stocks.map((s) => s.quantity)))}</TableCell>
            <TableCell className="text-right">{formatNumber(sum(product.stocks.map((s) => s.reserved)))}</TableCell><TableCell /><TableCell />
          </TableRow>
          {product.stocks.map((s) => (
            <TableRow key={s.branchId}>
              <TableCell>{branches.name(s.branchId)}</TableCell>
              <TableCell className="text-right">{formatNumber(s.quantity)}</TableCell>
              <TableCell className="text-right">{formatNumber(s.reserved)}</TableCell>
              <TableCell className="pl-4">{s.expectedOutDays == null ? "---" : t("fields.expectedOutDays", { n: formatNumber(s.expectedOutDays) })}</TableCell>
              <TableCell className="pl-4">
                <span className={product.active ? "rounded bg-[#e6f4ea] px-1.5 py-0.5 text-xs text-[#1e7e34]" : "rounded bg-[#fdecec] px-1.5 py-0.5 text-xs text-[#d92d20]"}>
                  {product.active ? t("detail.selling") : t("detail.discontinued")}</span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {product.lotManaged && (
        <Table>
          <TableHeader>
            <TableRow className={SUB_TABLE_HEAD_ROW}>
              <TableHead>{t("fields.lot")}</TableHead><TableHead>{t("fields.expiry")}</TableHead><TableHead>{tc("fields.branch")}</TableHead>
              <TableHead className="text-right">{t("detail.lotStock")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!lots.length && <ListEmptyRow cols={4} what={t("detail.lotsWhat")} compact />}
            {lots.map((l) => {
              const days = (new Date(l.expiryDate).getTime() - Date.now()) / 86_400_000;
              return (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.lotNumber}</TableCell>
                  <TableCell className={days < 0 ? "text-destructive" : days < 90 ? "text-orange-600" : ""}>
                    {formatDate(l.expiryDate)}{days < 0 ? ` (${t("detail.expired")})` : days < 90 ? ` (${t("detail.nearExpiry")})` : ""}
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
  const t = useT(productsNs);
  return (
    <Table>
      <TableHeader>
        <TableRow className={SUB_TABLE_HEAD_ROW}>
          <TableHead>{t("fields.code")}</TableHead><TableHead>{t("fields.name")}</TableHead><TableHead>{t("fields.einvoiceName")}</TableHead>
          <TableHead className="text-right">{t("fields.price")}</TableHead><TableHead className="text-right">{t("detail.salesVat")}</TableHead>
          <TableHead>{t("fields.taxReduction")}</TableHead><TableHead className="text-right">{t("fields.cost")}</TableHead>
          <TableHead className="text-right">{t("fields.stock")}</TableHead><TableHead className="text-right">{t("fields.reserved")}</TableHead>
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
                {u.barcode && <div className="text-xs text-muted-foreground">{t("detail.barcodeValue", { barcode: u.barcode })}</div>}
              </TableCell>
              <TableCell className="max-w-48 whitespace-normal">{product.einvoiceName}</TableCell>
              <TableCell className="text-right">{formatMoney(u.price)}</TableCell>
              <TableCell className="max-w-36 text-right whitespace-normal">{product.taxRateName}</TableCell>
              <TableCell>{product.taxReduction ? t("fields.taxReductionYes") : t("fields.taxReductionNo")}</TableCell>
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
