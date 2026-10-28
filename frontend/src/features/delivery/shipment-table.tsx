"use client";

import { Fragment } from "react";
import { useDeepLinkExpanded, type DeepLink } from "@/components/ui/deep-link-route";
import { DocCodeLink } from "@/components/ui/doc-code-link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ListEmptyRow } from "@/components/ui/list-empty-state";
import { LIST_HEAD_ROW, StatusBadge } from "@/features/sales/invoice-list-kit";
import { downloadCsv } from "@/features/sales/invoice-list-pager";
import { formatDateTime, formatMoney } from "@/lib/format";
import { useT, type TFunction } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { deliveryNs } from "@/messages/delivery";
import { SHIPMENT_STATUS_KEY, SHIPMENT_TONE, type ShipmentList } from "./delivery-types";
import { ShipmentDetailPanel } from "./shipment-detail-panel";

const COLS = 9;
const NO_LINK: DeepLink = { code: null, id: null };

/**
 * Bảng vận đơn (Quản lý giao hàng / Vận đơn): dòng tổng phí + thu hộ, chọn nhiều (cập nhật hàng loạt),
 * bấm dòng mở chi tiết ngay dưới (như KiotViet).
 */
export function ShipmentTable({ data, selected, onSelect, onWiden, compact, link = NO_LINK }: {
  data: ShipmentList | undefined; selected?: string[]; onSelect?: (ids: string[]) => void;
  /** Trạng thái rỗng: onWiden = mở rộng ra toàn thời gian; compact = bảng con trong panel chi tiết. */
  onWiden?: () => void; compact?: boolean;
  /** Link sâu của trang (?code=VD… / ?id=) → mở sẵn vận đơn đó. */
  link?: DeepLink;
}) {
  const t = useT(deliveryNs);
  const items = data?.items ?? [];
  const { open: expanded, setOpen: setExpanded, toggle: toggleRow } = useDeepLinkExpanded(data?.items, link, (s) => [s.code]);
  const pick = !!onSelect && !!selected;
  const all = pick && items.length > 0 && items.every((s) => selected.includes(s.id));
  const toggle = (id: string, on: boolean) => onSelect?.(on ? [...(selected ?? []), id] : (selected ?? []).filter((x) => x !== id));

  return (
    <div className="overflow-x-auto rounded-lg bg-background">
      <Table>
        <TableHeader><TableRow className={LIST_HEAD_ROW}>
          <TableHead className="w-10 pl-4">{pick && <input type="checkbox" aria-label={t("table.selectAll")} className="accent-primary" checked={all}
            onChange={(e) => onSelect?.(e.target.checked ? items.map((s) => s.id) : [])} />}</TableHead>
          <TableHead>{t("fields.shipmentCode")}</TableHead><TableHead>{t("fields.time")}</TableHead><TableHead>{t("fields.invoiceCode")}</TableHead>
          <TableHead>{t("table.customerReceiver")}</TableHead><TableHead>{t("fields.partner")}</TableHead>
          <TableHead className="text-right">{t("fields.fee")}</TableHead><TableHead className="text-right">{t("fields.cod")}</TableHead>
          <TableHead className="pr-4">{t("fields.status")}</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {!!items.length && <TableRow className="font-bold hover:bg-transparent">
            <TableCell colSpan={6} /><TableCell className="text-right">{formatMoney(data?.sumFee ?? 0)}</TableCell>
            <TableCell className="text-right">{formatMoney(data?.sumCod ?? 0)}</TableCell><TableCell />
          </TableRow>}
          {data && !items.length && <ListEmptyRow cols={COLS} what={t("table.emptyWhat")} onWiden={onWiden} compact={compact} />}
          {items.map((s) => (
            <Fragment key={s.id}>
              <TableRow className={cn("cursor-pointer", expanded === s.id && "bg-primary-tint hover:bg-primary-tint", s.status === "CANCELLED" && "text-muted-foreground")}
                onClick={() => toggleRow(s.id)}>
                <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
                  {pick && <input type="checkbox" aria-label={t("table.selectRow", { code: s.code })} className="accent-primary" checked={selected.includes(s.id)}
                    onChange={(e) => toggle(s.id, e.target.checked)} />}</TableCell>
                <TableCell>{s.code}</TableCell><TableCell>{formatDateTime(s.createdAt)}</TableCell><TableCell><DocCodeLink code={s.invoiceCode} kind="/invoices" /></TableCell>
                <TableCell className="whitespace-normal">{s.customerName}<div className="text-xs text-muted-foreground">{s.receiverName} - {s.receiverPhone}</div></TableCell>
                <TableCell>{s.partnerName}</TableCell>
                <TableCell className="text-right">{formatMoney(s.shippingFee)}</TableCell><TableCell className="text-right">{formatMoney(s.codAmount)}</TableCell>
                <TableCell className="pr-4"><StatusBadge tone={SHIPMENT_TONE[s.status]}>{t(SHIPMENT_STATUS_KEY[s.status])}</StatusBadge></TableCell>
              </TableRow>
              {expanded === s.id && <TableRow className="hover:bg-transparent"><TableCell colSpan={COLS} className="p-0 whitespace-normal"><ShipmentDetailPanel id={s.id} onClose={() => setExpanded(null)} /></TableCell></TableRow>}
            </Fragment>))}
        </TableBody>
      </Table>
    </div>
  );
}

const CSV_HEAD = ["shipmentCode", "time", "invoiceCode", "customer", "receiver", "phoneShort", "address", "area", "partnerShort",
  "fee", "feePayer", "codShort", "status", "reconcile"] as const;

/** Xuất CSV các vận đơn đang hiển thị (danh sách vận hành, không phải chứng từ đối soát → tiêu đề theo ngôn ngữ đang dùng). */
export function exportShipments(t: TFunction<typeof deliveryNs.vi>, data: ShipmentList | undefined) {
  downloadCsv(t("csv.shipmentsFile"), CSV_HEAD.map((k) => t(`fields.${k}`)), (data?.items ?? []).map((s) => [s.code,
    formatDateTime(s.createdAt), s.invoiceCode, s.customerName, s.receiverName, s.receiverPhone, s.receiverAddress, s.area, s.partnerName,
    s.shippingFee, t(`feePayerShort.${s.feePayer}`), s.codAmount, t(SHIPMENT_STATUS_KEY[s.status]),
    t(s.reconciled ? "csv.reconciledYes" : "csv.reconciledNo")]));
}
