"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { FileOutput, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeepLinkRoute, useDeepLinkExpanded, type DeepLink } from "@/components/ui/deep-link-route";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ListEmptyRow } from "@/components/ui/list-empty-state";
import { usePartners } from "@/features/delivery/delivery-queries";
import { PartnerDetailPanel } from "@/features/delivery/partner-detail-panel";
import { PartnerFormDialog } from "@/features/delivery/partner-form-dialog";
import { useSettlementOwner } from "@/features/delivery/use-settlement-owner";
import { FilterSection, FilterSidebar, LIST_HEAD_ROW, ListSearch, PageTitle, RadioOption, TOOLBAR_BTN } from "@/features/sales/invoice-list-kit";
import { downloadCsv, ListPager } from "@/features/sales/invoice-list-pager";
import { formatMoney } from "@/lib/format";
import { useCurrentUser } from "@/lib/use-current-user";
import { cn } from "@/lib/utils";

const COLS = 7;
const ACTIVE: [string, string][] = [["", "Tất cả"], ["true", "Đang hoạt động"], ["false", "Ngừng hoạt động"]];
const DEBT: [string, string][] = [["", "Tất cả"], ["OWING", "Đối tác còn nợ cửa hàng"], ["PAYABLE", "Cửa hàng còn nợ đối tác"]];

/**
 * Đối tác giao hàng (KiotViet): danh sách + dòng tổng (tổng đơn, phí giao hàng, cần thu hộ, nợ hiện tại), lọc trạng thái / công nợ,
 * thêm / sửa, chi tiết mở dưới dòng (vận đơn, sổ nợ, thanh toán, đối soát).
 * Link sâu: ?code=DT000001 (lọc theo mã, mở chi tiết) hoặc ?code=DS000001 (mở đối tác sở hữu phiếu → tab Lịch sử thanh toán).
 */
function DeliveryPartnersPage({ link }: { link: DeepLink }) {
  const settlementCode = link.code && /^DS\d/i.test(link.code) ? link.code : null;
  const { can } = useCurrentUser();
  const [search, setSearch] = useState(settlementCode ? "" : link.code ?? "");
  const [q, setQ] = useState(settlementCode ? "" : link.code ?? "");
  const [active, setActive] = useState("");
  const [debt, setDebt] = useState("");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(15);
  const [creating, setCreating] = useState(false);
  useEffect(() => { const t = setTimeout(() => { setQ(search); setPage(0); }, 300); return () => clearTimeout(t); }, [search]);
  const params = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), size: String(size) });
    if (q) p.set("q", q);
    if (active) p.set("active", active);
    if (debt) p.set("debt", debt);
    return p;
  }, [q, active, debt, page, size]);
  const { data } = usePartners(params);
  const owner = useSettlementOwner(settlementCode, data?.items.map((p) => p.id) ?? []);
  const { open: expanded, setOpen: setExpanded, toggle } = useDeepLinkExpanded(data?.items, link, (p) => [p.code, p.id === owner ? settlementCode : null]);
  const exportCsv = () => downloadCsv("doi-tac-giao-hang", ["Mã", "Tên", "Điện thoại", "Email", "Địa chỉ", "Tổng đơn", "Phí giao hàng",
    "Cần thu hộ", "Nợ cần thu từ ĐTGH", "Trạng thái"], (data?.items ?? []).map((p) => [p.code, p.name, p.phone, p.email, p.address,
    p.shipmentCount, p.totalFee, p.totalCod, p.debt, p.active ? "Đang hoạt động" : "Ngừng hoạt động"]));

  return (
    <div className="flex gap-2.5">
      <div className="space-y-3">
        <PageTitle>Đối tác giao hàng</PageTitle>
        <FilterSidebar>
          <FilterSection title="Trạng thái">{ACTIVE.map(([v, l]) => <RadioOption key={v} checked={active === v} onSelect={() => { setActive(v); setPage(0); }}>{l}</RadioOption>)}</FilterSection>
          <FilterSection title="Công nợ">{DEBT.map(([v, l]) => <RadioOption key={v} checked={debt === v} onSelect={() => { setDebt(v); setPage(0); }}>{l}</RadioOption>)}</FilterSection>
        </FilterSidebar>
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex items-center gap-2">
          <ListSearch value={search} onChange={setSearch} placeholder="Theo mã, tên, số điện thoại" />
          {can("sales.perform") && <Button variant="outline" className={cn(TOOLBAR_BTN, "ml-auto")} onClick={() => setCreating(true)}><Plus className="size-4" /> Đối tác giao hàng</Button>}
          <Button variant="outline" className={cn(TOOLBAR_BTN, !can("sales.perform") && "ml-auto")} disabled={!data?.items.length} onClick={exportCsv}>
            <FileOutput className="size-4" /> Xuất file</Button>
        </div>
        <div className="overflow-x-auto rounded-lg bg-background">
          <Table>
            <TableHeader><TableRow className={LIST_HEAD_ROW}>
              <TableHead className="pl-4">Mã đối tác</TableHead><TableHead>Tên đối tác</TableHead><TableHead>Điện thoại</TableHead>
              <TableHead className="text-right">Tổng đơn</TableHead><TableHead className="text-right">Phí giao hàng</TableHead>
              <TableHead className="text-right">Cần thu hộ</TableHead><TableHead className="pr-4 text-right" title="Dương: đối tác nợ cửa hàng; âm: cửa hàng nợ đối tác">Nợ cần thu từ ĐTGH</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {!!data?.items.length && <TableRow className="font-bold hover:bg-transparent">
                <TableCell colSpan={4} /><TableCell className="text-right">{formatMoney(data.sumFee ?? 0)}</TableCell>
                <TableCell className="text-right">{formatMoney(data.sumCod ?? 0)}</TableCell><TableCell className="pr-4 text-right">{formatMoney(data.sumDebt ?? 0)}</TableCell>
              </TableRow>}
              {data && !data.items.length && <ListEmptyRow cols={COLS} what="đối tác giao hàng" />}
              {data?.items.map((p) => (
                <Fragment key={p.id}>
                  <TableRow className={cn("cursor-pointer", expanded === p.id && "bg-primary-tint hover:bg-primary-tint", !p.active && "text-muted-foreground")}
                    onClick={() => toggle(p.id)}>
                    <TableCell className="pl-4">{p.code}</TableCell><TableCell>{p.name}</TableCell><TableCell>{p.phone}</TableCell>
                    <TableCell className="text-right">{p.shipmentCount}</TableCell><TableCell className="text-right">{formatMoney(p.totalFee)}</TableCell>
                    <TableCell className="text-right">{formatMoney(p.totalCod)}</TableCell><TableCell className="pr-4 text-right">{formatMoney(p.debt)}</TableCell>
                  </TableRow>
                  {expanded === p.id && <TableRow className="hover:bg-transparent"><TableCell colSpan={COLS} className="p-0 whitespace-normal"><PartnerDetailPanel partner={p} initialTab={p.id === owner ? "payments" : undefined} onClose={() => setExpanded(null)} /></TableCell></TableRow>}
                </Fragment>))}
            </TableBody>
          </Table>
        </div>
        <ListPager total={data?.total ?? 0} page={page} size={size} unit="đối tác" onPage={setPage} onSize={(s) => { setSize(s); setPage(0); }} />
      </div>
      {creating && <PartnerFormDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

export default function Page() {
  return <DeepLinkRoute>{(link) => <DeliveryPartnersPage link={link} />}</DeepLinkRoute>;
}
