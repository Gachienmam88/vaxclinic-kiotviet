"use client";

import { Fragment } from "react";
import { useDeepLinkExpanded, type DeepLink } from "@/components/ui/deep-link-route";
import { DocCodeLink } from "@/components/ui/doc-code-link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ListEmptyRow } from "@/components/ui/list-empty-state";
import { LIST_HEAD_ROW, StatusBadge } from "@/features/sales/invoice-list-kit";
import { downloadCsv } from "@/features/sales/invoice-list-pager";
import { formatDateTime, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SHIPMENT_TONE, shipmentStatusLabel, type ShipmentList } from "./delivery-types";
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
  const items = data?.items ?? [];
  const { open: expanded, setOpen: setExpanded, toggle: toggleRow } = useDeepLinkExpanded(data?.items, link, (s) => [s.code]);
  const pick = !!onSelect && !!selected;
  const all = pick && items.length > 0 && items.every((s) => selected.includes(s.id));
  const toggle = (id: string, on: boolean) => onSelect?.(on ? [...(selected ?? []), id] : (selected ?? []).filter((x) => x !== id));

  return (
    <div className="overflow-x-auto rounded-lg bg-background">
      <Table>
        <TableHeader><TableRow className={LIST_HEAD_ROW}>
          <TableHead className="w-10 pl-4">{pick && <input type="checkbox" aria-label="Chọn tất cả" className="accent-primary" checked={all}
            onChange={(e) => onSelect?.(e.target.checked ? items.map((s) => s.id) : [])} />}</TableHead>
          <TableHead>Mã vận đơn</TableHead><TableHead>Thời gian</TableHead><TableHead>Mã hóa đơn</TableHead>
          <TableHead>Khách hàng / Người nhận</TableHead><TableHead>Đối tác giao hàng</TableHead>
          <TableHead className="text-right">Phí giao hàng</TableHead><TableHead className="text-right">Thu hộ (COD)</TableHead>
          <TableHead className="pr-4">Trạng thái</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {!!items.length && <TableRow className="font-bold hover:bg-transparent">
            <TableCell colSpan={6} /><TableCell className="text-right">{formatMoney(data?.sumFee ?? 0)}</TableCell>
            <TableCell className="text-right">{formatMoney(data?.sumCod ?? 0)}</TableCell><TableCell />
          </TableRow>}
          {data && !items.length && <ListEmptyRow cols={COLS} what="vận đơn" onWiden={onWiden} compact={compact} />}
          {items.map((s) => (
            <Fragment key={s.id}>
              <TableRow className={cn("cursor-pointer", expanded === s.id && "bg-[#e3f0fc] hover:bg-[#e3f0fc]", s.status === "CANCELLED" && "text-muted-foreground")}
                onClick={() => toggleRow(s.id)}>
                <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
                  {pick && <input type="checkbox" aria-label={`Chọn ${s.code}`} className="accent-primary" checked={selected.includes(s.id)}
                    onChange={(e) => toggle(s.id, e.target.checked)} />}</TableCell>
                <TableCell>{s.code}</TableCell><TableCell>{formatDateTime(s.createdAt)}</TableCell><TableCell><DocCodeLink code={s.invoiceCode} kind="/invoices" /></TableCell>
                <TableCell className="whitespace-normal">{s.customerName}<div className="text-xs text-muted-foreground">{s.receiverName} - {s.receiverPhone}</div></TableCell>
                <TableCell>{s.partnerName}</TableCell>
                <TableCell className="text-right">{formatMoney(s.shippingFee)}</TableCell><TableCell className="text-right">{formatMoney(s.codAmount)}</TableCell>
                <TableCell className="pr-4"><StatusBadge tone={SHIPMENT_TONE[s.status]}>{shipmentStatusLabel(s.status)}</StatusBadge></TableCell>
              </TableRow>
              {expanded === s.id && <TableRow className="hover:bg-transparent"><TableCell colSpan={COLS} className="p-0 whitespace-normal"><ShipmentDetailPanel id={s.id} onClose={() => setExpanded(null)} /></TableCell></TableRow>}
            </Fragment>))}
        </TableBody>
      </Table>
    </div>
  );
}

/** Xuất CSV các vận đơn đang hiển thị. */
export function exportShipments(data: ShipmentList | undefined) {
  downloadCsv("van-don", ["Mã vận đơn", "Thời gian", "Mã hóa đơn", "Khách hàng", "Người nhận", "SĐT", "Địa chỉ", "Khu vực", "Đối tác",
    "Phí giao hàng", "Người trả phí", "Thu hộ", "Trạng thái", "Đối soát"], (data?.items ?? []).map((s) => [s.code, formatDateTime(s.createdAt),
    s.invoiceCode, s.customerName, s.receiverName, s.receiverPhone, s.receiverAddress, s.area, s.partnerName, s.shippingFee,
    s.feePayer === "SHOP" ? "Cửa hàng" : "Người nhận", s.codAmount, shipmentStatusLabel(s.status), s.reconciled ? "Đã đối soát" : "Chưa"]));
}
