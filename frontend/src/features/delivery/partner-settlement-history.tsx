"use client";

import { DocCodeLink } from "@/components/ui/doc-code-link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LIST_HEAD_ROW, StatusBadge } from "@/features/sales/invoice-list-kit";
import { formatDateTime, formatMoney } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { deliveryNs } from "@/messages/delivery";
import { useAllSettlements } from "./delivery-queries";
import { PartnersEmpty } from "./partners-empty";

/** Tab "Lịch sử đối soát": phiếu đối soát / thanh toán của mọi đối tác (mới nhất trước, tối đa 200). */
export function PartnerSettlementHistory() {
  const t = useT(deliveryNs);
  const { data } = useAllSettlements(true);
  const head = ["stlCode", "stlTime", "stlPartner", "stlKind", "stlAmount", "stlVoucher", "stlStatus"] as const;
  if (data && !data.length) return <PartnersEmpty cols={head.map((h) => t(`kv.partners.${h}`))} />;
  return (
    <Table stickyHeader>
      <TableHeader><TableRow className={LIST_HEAD_ROW}>
        {head.map((h, i) => <TableHead key={h} className={h === "stlAmount" ? "text-right" : i === 0 ? "pl-4" : ""}>{t(`kv.partners.${h}`)}</TableHead>)}
      </TableRow></TableHeader>
      <TableBody>
        {data?.map((s) => (
          <TableRow key={s.id}>
            <TableCell className="pl-4"><DocCodeLink code={s.code} kind="/delivery/partners" /></TableCell>
            <TableCell>{formatDateTime(s.createdAt)}</TableCell>
            <TableCell><DocCodeLink code={s.partnerCode} kind="/delivery/partners" /> {s.partnerName}</TableCell>
            <TableCell>{t(`kv.partners.kinds.${s.kind}`)}</TableCell>
            <TableCell className="text-right">{formatMoney(s.amount)}</TableCell>
            <TableCell>{s.voucherCode ? <DocCodeLink code={s.voucherCode} kind="/cashbook" /> : "—"}</TableCell>
            <TableCell><StatusBadge tone={s.status === "CANCELLED" ? "red" : "green"}>
              {t(`kv.partners.stlStatuses.${s.status === "CANCELLED" ? "CANCELLED" : "COMPLETED"}`)}</StatusBadge></TableCell>
          </TableRow>))}
      </TableBody>
    </Table>
  );
}
