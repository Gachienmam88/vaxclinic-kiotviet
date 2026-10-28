"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { FileOutput, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeepLinkRoute, useDeepLinkExpanded, type DeepLink } from "@/components/ui/deep-link-route";
import { ListEmptyRow } from "@/components/ui/list-empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CashVoucherDetail } from "@/features/sales/cash-voucher-detail";
import { CashVoucherDialog } from "@/features/sales/cash-voucher-dialog";
import { CashVoucherFilterSidebar, type CashFilters } from "@/features/sales/cash-voucher-filter-sidebar";
import { LIST_HEAD_ROW, ListSearch, PageTitle, TOOLBAR_BTN } from "@/features/sales/invoice-list-kit";
import { downloadCsv, ListPager } from "@/features/sales/invoice-list-pager";
import { periodParams, useCashbook } from "@/features/sales/sales-queries";
import { enumLabel } from "@/features/sales/i18n-enum-label";
import { formatDateTime, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { cashbookNs } from "@/messages/cashbook";

/**
 * Sổ quỹ. Link sâu: /cashbook?code=PT000001 (hoặc ?id=<uuid>) → Tổng quỹ, mọi thời gian, cả phiếu đã hủy, mở chi tiết phiếu
 * (thời gian để trống = không giới hạn, sidebar không có "Toàn thời gian").
 * Xuất CSV: sổ quỹ là chứng từ kế toán → giữ tiêu đề cột / trạng thái tiếng Việt ở mọi ngôn ngữ.
 */
function CashbookPage({ link }: { link: DeepLink }) {
  const t = useT(cashbookNs);
  const tc = useT(commonNs);
  const deepLink = !!(link.code || link.id);
  const [filters, setFilters] = useState<CashFilters>({
    fund: deepLink ? "ALL" : "CASH", period: { mode: deepLink ? "custom" : "month", from: "", to: "" }, types: [], category: "",
    statuses: deepLink ? ["PAID", "CANCELLED"] : ["PAID"], accounting: "",
    createdBy: "", collectorId: "", partnerType: "", partner: "",
  });
  const [search, setSearch] = useState(link.code ?? "");
  const [q, setQ] = useState(link.code ?? "");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(15);
  const [dialog, setDialog] = useState<"RECEIPT" | "PAYMENT" | null>(null);
  useEffect(() => { const t = setTimeout(() => { setQ(search); setPage(0); }, 300); return () => clearTimeout(t); }, [search]);

  const params = useMemo(() => {
    const f = filters;
    const p = periodParams(f.period, new URLSearchParams({ fund: f.fund, page: String(page), size: String(size) }));
    f.types.forEach((t) => p.append("voucherTypes", t));
    f.statuses.forEach((s) => p.append("statuses", s));
    const optional = { category: f.category, accounting: f.accounting, createdBy: f.createdBy, collectorId: f.collectorId,
      partnerType: f.partnerType, partner: f.partner, q };
    Object.entries(optional).forEach(([k, v]) => v && p.set(k, v));
    return p;
  }, [filters, q, page, size]);
  const { data } = useCashbook(params);
  const { open: expanded, setOpen: setExpanded, toggle } = useDeepLinkExpanded(data?.items, link, (v) => [v.code]);
  const s = data?.summary;
  const signed = (v: { voucherType: string; amount: number }) => (v.voucherType === "PAYMENT" ? -v.amount : v.amount);
  const exportCsv = () => downloadCsv("so-quy", ["Mã phiếu", "Thời gian", "Loại thu chi", "Người nộp/nhận", "Giá trị", "Trạng thái"],
    (data?.items ?? []).map((v) => [v.code, formatDateTime(v.occurredAt), v.category, v.partnerName, signed(v), v.status === "PAID" ? "Đã thanh toán" : "Đã hủy"]));
  const summary = [[t("page.summary.opening"), s?.opening ?? 0, "text-foreground"], [t("page.summary.receipts"), s?.receipts ?? 0, "text-primary"],
    [t("page.summary.payments"), s ? -s.payments : 0, "text-[#d93025]"], [t("page.summary.closing"), s?.closing ?? 0, "text-[#0f9d58]"]] as const;

  return (
    <div className="flex gap-2.5">
      <div className="space-y-3">
        <PageTitle>{enumLabel(t, cashbookNs, "page.title", filters.fund)}</PageTitle>
        <CashVoucherFilterSidebar value={filters} onChange={(f) => { setFilters(f); setPage(0); }} />
      </div>
      <div className="min-w-0 flex-1 space-y-2.5">
        <div className="flex items-center gap-2">
          <ListSearch value={search} onChange={setSearch} placeholder={t("page.searchPlaceholder")} />
          <Button variant="outline" className={cn(TOOLBAR_BTN, "ml-auto")} onClick={() => setDialog("RECEIPT")}><Plus className="size-4" /> {t("page.newReceipt")}</Button>
          <Button variant="outline" className={TOOLBAR_BTN} onClick={() => setDialog("PAYMENT")}><Plus className="size-4" /> {t("page.newPayment")}</Button>
          <Button variant="outline" className={TOOLBAR_BTN} disabled={!data?.items.length} onClick={exportCsv}
            title={t("page.exportTitle")}><FileOutput className="size-4" /> {tc("actions.export")}</Button>
        </div>
        <div className="flex justify-end rounded-lg bg-background px-4 py-3">
          {summary.map(([l, v, c]) => (
            <div key={l} className="w-[180px] space-y-1 text-right">
              <div className="text-muted-foreground">{l}</div><div className={cn("text-[15px] font-bold", c)}>{formatMoney(v)}</div>
            </div>))}
        </div>
        <div className="overflow-x-auto rounded-lg bg-background">
          <Table>
            <TableHeader><TableRow className={LIST_HEAD_ROW}>
              <TableHead className="pl-4">{t("page.cols.code")}</TableHead><TableHead>{t("page.cols.time")}</TableHead><TableHead>{t("page.cols.category")}</TableHead>
              <TableHead>{t("page.cols.partner")}</TableHead><TableHead className="pr-4 text-right">{t("page.cols.amount")}</TableHead></TableRow></TableHeader>
            <TableBody>
              {data && !data.items.length && <ListEmptyRow cols={5} what={t("page.emptyWhat")}
                onWiden={filters.period.mode === "month" ? () => setFilters({ ...filters, period: { mode: "custom", from: "", to: "" } }) : undefined} />}
              {data?.items.map((v) => (
                <Fragment key={v.id}>
                  <TableRow className={cn("cursor-pointer", expanded === v.id && "bg-primary-tint hover:bg-primary-tint", v.status === "CANCELLED" && "text-muted-foreground line-through")}
                    onClick={() => toggle(v.id)}>
                    <TableCell className="pl-4">{v.code}</TableCell><TableCell>{formatDateTime(v.occurredAt)}</TableCell>
                    <TableCell>{v.category}</TableCell><TableCell className="whitespace-normal">{v.partnerName}</TableCell>
                    <TableCell className="pr-4 text-right">{formatMoney(signed(v))}</TableCell>
                  </TableRow>
                  {expanded === v.id && <TableRow className="hover:bg-transparent"><TableCell colSpan={5} className="p-0 whitespace-normal"><CashVoucherDetail id={v.id} onClose={() => setExpanded(null)} /></TableCell></TableRow>}
                </Fragment>))}
            </TableBody>
          </Table>
        </div>
        <ListPager total={data?.total ?? 0} page={page} size={size} unit={t("page.unit")} onPage={setPage} onSize={(n) => { setSize(n); setPage(0); }} />
      </div>
      {dialog && <CashVoucherDialog type={dialog} onClose={() => setDialog(null)} />}
    </div>
  );
}

export default function Page() {
  return <DeepLinkRoute>{(link) => <CashbookPage link={link} />}</DeepLinkRoute>;
}
