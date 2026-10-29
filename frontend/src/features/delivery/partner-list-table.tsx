"use client";

import { Fragment } from "react";
import { useDeepLinkExpanded, type DeepLink } from "@/components/ui/deep-link-route";
import { DocCodeLink } from "@/components/ui/doc-code-link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LIST_HEAD_ROW } from "@/features/sales/invoice-list-kit";
import { formatMoney, formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { deliveryNs } from "@/messages/delivery";
import type { DeliveryPartner, PartnerList } from "./delivery-types";
import { PartnerDetailPanel } from "./partner-detail-panel";
import { PartnersEmpty } from "./partners-empty";

export type PartnerColumn = "code" | "name" | "total" | "cod" | "codOpen" | "fee" | "feeOpen";
export const PARTNER_COLUMNS: PartnerColumn[] = ["code", "name", "total", "cod", "codOpen", "fee", "feeOpen"];
const NUM = new Set<PartnerColumn>(["total", "cod", "codOpen", "fee", "feeOpen"]);

/** Giá trị cột (số liệu tính từ vận đơn: tổng đơn chưa hủy, thu hộ cần thu, thu hộ / phí đã ghi sổ chưa đối soát). */
export function partnerValue(p: DeliveryPartner, c: PartnerColumn): string | number {
  switch (c) {
    case "code": return p.code;
    case "name": return p.name;
    case "total": return p.shipmentCount;
    case "cod": return Number(p.totalCod);
    case "codOpen": return Number(p.codOpen ?? 0);
    case "fee": return Number(p.totalFee);
    case "feeOpen": return Number(p.feeOpen ?? 0);
  }
}

/** Bảng "Thông tin" của Đối tác giao hàng: 7 cột như KiotViet + dòng tổng, bấm dòng mở chi tiết đối tác. */
export function PartnerListTable({ data, shown, link, owner }: {
  data: PartnerList | undefined; shown: (c: PartnerColumn) => boolean; link: DeepLink; owner: string | null;
}) {
  const t = useT(deliveryNs);
  const cols = PARTNER_COLUMNS.filter(shown);
  const items = data?.items ?? [];
  const settlementCode = link.code && /^DS\d/i.test(link.code) ? link.code : null;
  const { open, setOpen, toggle } = useDeepLinkExpanded(data?.items, link, (p) => [p.code, p.id === owner ? settlementCode : null]);
  const sums: Partial<Record<PartnerColumn, number | undefined>> = { total: data?.sumShipments, cod: data?.sumCod, codOpen: data?.sumCodOpen,
    fee: data?.sumFee, feeOpen: data?.sumFeeOpen };
  const fmt = (c: PartnerColumn, v: number | string) => (c === "total" ? formatNumber(Number(v)) : NUM.has(c) ? formatMoney(Number(v)) : v);
  if (data && !items.length) return <PartnersEmpty cols={cols.map((c) => t(`kv.partners.${c}`))} />;
  return (
    <Table stickyHeader>
      <TableHeader><TableRow className={LIST_HEAD_ROW}>
        {cols.map((c, i) => <TableHead key={c} className={cn(NUM.has(c) && "text-right", i === 0 && "pl-4")}>{t(`kv.partners.${c}`)}</TableHead>)}
      </TableRow></TableHeader>
      <TableBody>
        {!!items.length && <TableRow className="h-9 font-bold hover:bg-transparent">
          {cols.map((c) => <TableCell key={c} className="text-right">{sums[c] != null ? fmt(c, sums[c]!) : ""}</TableCell>)}</TableRow>}
        {items.map((p) => (
          <Fragment key={p.id}>
            <TableRow className={cn("cursor-pointer", open === p.id && "bg-primary-tint hover:bg-primary-tint", !p.active && "text-muted-foreground")}
              onClick={() => toggle(p.id)}>
              {cols.map((c, i) => <TableCell key={c} className={cn(NUM.has(c) && "text-right", i === 0 && "pl-4")}>
                {c === "code" ? <DocCodeLink code={p.code} kind="/delivery/partners" /> : fmt(c, partnerValue(p, c))}</TableCell>)}
            </TableRow>
            {open === p.id && <TableRow className="hover:bg-transparent"><TableCell colSpan={cols.length} className="p-0 whitespace-normal">
              <PartnerDetailPanel partner={p} initialTab={p.id === owner ? "payments" : undefined} onClose={() => setOpen(null)} /></TableCell></TableRow>}
          </Fragment>))}
      </TableBody>
    </Table>
  );
}
