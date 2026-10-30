"use client";

import Link from "next/link";
import { ExternalLink, Eye } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { docCodeHref } from "@/components/ui/doc-code-link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ListEmptyRow } from "@/components/ui/list-empty-state";
import { LIST_HEAD_ROW, StatusBadge } from "@/features/sales/invoice-list-kit";
import { formatDate, formatMoney } from "@/lib/format";
import { linkOf, NATURE_KEY, type InputInvoice } from "./integration-queries";
import { InputInvoiceCreateMenu, type CreateKind } from "./input-invoice-create-menu";
import { useT } from "@/lib/i18n";
import { inputInvoicesNs } from "@/messages/input-invoices";

const COLS = 9;

type Props = {
  items: InputInvoice[] | undefined;
  selected: string[];
  onSelect: (ids: string[]) => void;
  onView: (inv: InputInvoice) => void;
  onCreate: (inv: InputInvoice, kind: CreateKind) => void;
};

/** "Đã lập phiếu ↗": mở đúng chứng từ (phiếu nhập / phiếu chi NCC / phiếu Sổ quỹ) qua link sâu ?code= (mọi trạng thái). */
function LinkedBadge({ code }: { code: string }) {
  const t = useT(inputInvoicesNs);
  const href = docCodeHref(code);
  const badge = <StatusBadge tone="green" title={code}>{t("filter.created")} <ExternalLink className="size-3" /></StatusBadge>;
  return href ? <Link href={href} prefetch={false} aria-label={t("table.openDoc", { code })} onClick={(e) => e.stopPropagation()}>{badge}</Link> : badge;
}

/** Bảng "Danh sách hóa đơn" đầu vào (KiotViet): chọn dòng, trạng thái lập phiếu, tính chất, Lập phiếu ▾ + xem chi tiết. */
export function InputInvoiceTable({ items, selected, onSelect, onView, onCreate }: Props) {
  const t = useT(inputInvoicesNs);
  const ids = items?.map((i) => i.id) ?? [];
  const all = ids.length > 0 && ids.every((id) => selected.includes(id));
  const toggle = (id: string, on: boolean) => onSelect(on ? [...selected, id] : selected.filter((x) => x !== id));
  return (
    <div className="overflow-x-auto rounded-lg bg-background">
      <Table stickyHeader>
        <TableHeader><TableRow className={LIST_HEAD_ROW}>
          <TableHead className="w-10 pl-4"><Checkbox aria-label={t("table.selectAll")} checked={all}
            onCheckedChange={(v) => onSelect(v === true ? [...new Set([...selected, ...ids])] : selected.filter((x) => !ids.includes(x)))} /></TableHead>
          <TableHead>{t("table.number")}</TableHead><TableHead>{t("table.date")}</TableHead>
          <TableHead>{t("filter.supplier")}</TableHead><TableHead>{t("filter.taxCode")}</TableHead>
          <TableHead className="text-right">{t("table.total")}</TableHead>
          <TableHead>{t("filter.receiptStatus")}</TableHead><TableHead>{t("filter.nature")}</TableHead>
          <TableHead className="pr-4 text-right">{t("table.actions")}</TableHead></TableRow></TableHeader>
        <TableBody>
          {items && !items.length && <ListEmptyRow cols={COLS} what={t("page.unit")} />}
          {items?.map((i) => {
            const link = linkOf(i);
            return (
              <TableRow key={i.id} className="align-top">
                <TableCell className="pl-4"><Checkbox aria-label={t("table.selectRow", { number: i.number })} checked={selected.includes(i.id)}
                  onCheckedChange={(v) => toggle(i.id, v === true)} /></TableCell>
                <TableCell>{i.number}</TableCell><TableCell>{formatDate(i.issuedAt)}</TableCell>
                <TableCell className="max-w-72 whitespace-normal">{i.sellerName ?? ""} - {i.sellerTaxCode}</TableCell>
                <TableCell>{i.buyerTaxCode}</TableCell><TableCell className="text-right">{formatMoney(i.total)}</TableCell>
                <TableCell>{link.id && link.code ? <LinkedBadge code={link.code} /> : <StatusBadge tone="gray">{t("filter.notCreated")}</StatusBadge>}</TableCell>
                <TableCell><StatusBadge tone="gray">{t(NATURE_KEY[i.nature])}</StatusBadge></TableCell>
                <TableCell className="pr-4">
                  <div className="flex justify-end gap-1.5">
                    {!link.id && <InputInvoiceCreateMenu onPick={(kind) => onCreate(i, kind)} />}
                    <button type="button" aria-label={t("table.view", { number: i.number })} onClick={() => onView(i)}
                      className="inline-flex size-7 items-center justify-center rounded-md border bg-background hover:bg-muted"><Eye className="size-4" /></button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
