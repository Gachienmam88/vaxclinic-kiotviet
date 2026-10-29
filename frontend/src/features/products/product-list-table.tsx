"use client";

import { Fragment } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ListEmptyRow } from "@/components/ui/list-empty-state";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { productsNs } from "@/messages/products";
import { ProductDetailPanel } from "./product-detail-panel";
import type { ProductDetail, ProductListResponse } from "./product-types";

const COLS = 11;
/** Tổng bề rộng 3 cột sau Tồn kho (Khách đặt, Thời gian tạo, Dự kiến hết hàng): nằm ngoài khung, cuộn ngang mới thấy. */
const EXTRA_W = "400px";

type Props = {
  data: ProductListResponse | undefined;
  isLoading: boolean;
  expanded: string | null;
  onToggle: (id: string) => void;
  onEdit: (p: ProductDetail) => void;
};

/** Bảng danh sách hàng hóa: dòng tổng tồn ở đầu, bấm dòng để mở panel chi tiết ngay bên dưới. */
export function ProductListTable({ data, isLoading, expanded, onToggle, onEdit }: Props) {
  const t = useT(productsNs);
  const tc = useT(commonNs);
  return (
    <div className="overflow-x-auto rounded-lg bg-background">
      <Table style={{ minWidth: `calc(100% + ${EXTRA_W})` }}>
        <TableHeader>
          <TableRow className="bg-primary-tint hover:bg-primary-tint">
            <TableHead className="w-28 pl-4">{t("fields.code")}</TableHead>
            <TableHead>{t("fields.name")}</TableHead>
            <TableHead>{t("fields.shortName")}</TableHead>
            <TableHead className="text-right">{t("fields.price")}</TableHead>
            <TableHead className="text-right">{t("detail.salesVat")}</TableHead>
            <TableHead>{t("fields.taxReduction")}</TableHead>
            <TableHead className="text-right">{t("fields.cost")}</TableHead>
            <TableHead className="text-right">{t("fields.stock")}</TableHead>
            <TableHead className="w-[110px] text-right">{t("fields.reserved")}</TableHead>
            <TableHead className="w-[150px] pl-6">{t("filter.createdTime")}</TableHead>
            <TableHead className="w-[140px] pr-4">{t("fields.expectedOut")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {!!data?.items.length && <TableRow className="hover:bg-transparent">
            <TableCell colSpan={7} />
            <TableCell className="text-right font-bold">{formatNumber(data.totalStock ?? 0)}</TableCell>
            <TableCell colSpan={3} />
          </TableRow>}
          {isLoading && (
            <TableRow><TableCell colSpan={COLS} className="py-8 text-center text-muted-foreground">{tc("status.loading")}</TableCell></TableRow>
          )}
          {data && !data.items.length && <ListEmptyRow cols={COLS} what={t("list.emptyWhat")} />}
          {data?.items.map((p) => {
            const open = expanded === p.id;
            return (
              <Fragment key={p.id}>
                <TableRow onClick={() => onToggle(p.id)} aria-expanded={open}
                  className={cn("cursor-pointer align-top [&>td]:py-3", open && "bg-primary-tint hover:bg-primary-tint",
                    !p.active && "text-muted-foreground")}>
                  <TableCell className="pl-4">{p.code}</TableCell>
                  <TableCell className="max-w-44 min-w-36 whitespace-normal">
                    {p.name}
                    {p.otherUnits.length > 0
                      ? <> <span className="text-muted-foreground">- {p.unitName}</span>
                        <span className="text-primary"> - {p.otherUnits.join(", ")}</span></>
                      : <span> ({p.unitName})</span>}
                    {p.lotManaged && <span className="ml-1 text-xs text-muted-foreground">· {t("fields.lot")}</span>}
                  </TableCell>
                  <TableCell className="max-w-36 whitespace-normal">{p.shortName}</TableCell>
                  <TableCell className="text-right">{formatMoney(p.price)}</TableCell>
                  <TableCell className="text-right" title={p.taxRateName ?? ""}>{p.taxRateName?.split(" ")[0]}</TableCell>
                  <TableCell>{p.taxReduction ? t("fields.taxReductionYes") : t("fields.taxReductionNo")}</TableCell>
                  <TableCell className="text-right">{formatNumber(p.cost)}</TableCell>
                  <TableCell className="text-right">{formatNumber(p.stock)}</TableCell>
                  <TableCell className="text-right">{formatNumber(p.reserved)}</TableCell>
                  <TableCell className="pl-6">{formatDateTime(p.createdAt)}</TableCell>
                  <TableCell className="pr-4">
                    {p.expectedOutDays == null ? "---" : t("fields.expectedOutDays", { n: formatNumber(p.expectedOutDays) })}
                  </TableCell>
                </TableRow>
                {open && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={COLS} className="h-auto p-0 whitespace-normal">
                      {/* Panel rộng đúng khung nhìn và bám trái khi cuộn ngang. */}
                      <div className="sticky left-0" style={{ width: `calc(100% - ${EXTRA_W})` }}>
                        <ProductDetailPanel productId={p.id} onEdit={onEdit} onClose={() => onToggle(p.id)} />
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
