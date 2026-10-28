"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { HandCoins, Pencil, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DocCodeLink } from "@/components/ui/doc-code-link";
import { DetailTabsList } from "@/components/ui/detail-tabs-list";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ListEmptyRow } from "@/components/ui/list-empty-state";
import { DETAIL_BTN, DETAIL_PANEL, DETAIL_TAB, DETAIL_TABS_LIST, StatusBadge, SUB_HEAD } from "@/features/sales/invoice-list-kit";
import { api, errorMessage } from "@/lib/api-client";
import { formatDateTime, formatMoney } from "@/lib/format";
import { useCurrentUser } from "@/lib/use-current-user";
import { refreshDelivery, usePartnerLedger, usePartnerSettlements, useShipments } from "./delivery-queries";
import { LEDGER_LABELS, type DeliveryPartner } from "./delivery-types";
import { PartnerFormDialog } from "./partner-form-dialog";
import { PartnerPaymentDialog } from "./partner-payment-dialog";
import { ReconcileDialog } from "./reconcile-dialog";
import { ShipmentTable } from "./shipment-table";
import { joinAddress } from "@/lib/vn-admin-search";

const KIND: Record<string, string> = { RECONCILE: "Đối soát", RECEIPT: "Thu tiền đối tác", PAYMENT: "Trả tiền đối tác" };
const ROW = "border-b [&_td]:h-[30px] [&_td]:px-2";

/**
 * Chi tiết đối tác giao hàng: Thông tin, Lịch sử giao hàng (vận đơn), Nợ cần thu từ ĐTGH (sổ công nợ: thu hộ +, phí −,
 * thanh toán), Lịch sử thanh toán (phiếu đối soát / thanh toán, hủy được). Nút: Sửa, Xóa, Thanh toán, Đối soát.
 */
/** initialTab: tab mở sẵn (link sâu phiếu đối soát → "payments"). */
export function PartnerDetailPanel({ partner: p, onClose, initialTab }: { partner: DeliveryPartner; onClose?: () => void; initialTab?: string }) {
  const qc = useQueryClient();
  const { can } = useCurrentUser();
  const [dialog, setDialog] = useState<"edit" | "pay" | "reconcile" | null>(null);
  const shipParams = useMemo(() => new URLSearchParams({ partnerId: p.id, size: "50" }), [p.id]);
  const { data: shipments } = useShipments(shipParams);
  const { data: ledger = [] } = usePartnerLedger(p.id);
  const { data: settlements = [] } = usePartnerSettlements(p.id);
  const remove = useMutation({
    mutationFn: () => api(`/delivery-partners/${p.id}`, { method: "DELETE" }),
    onSuccess: () => { toast.success(`Đã xóa đối tác ${p.name}`); refreshDelivery(qc); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const cancel = useMutation({
    mutationFn: (id: string) => api(`/delivery-partners/settlements/${id}/cancel`, { method: "POST" }),
    onSuccess: () => { toast.success("Đã hủy phiếu thanh toán / đối soát"); refreshDelivery(qc); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const info = (label: string, value: React.ReactNode) => (
    <div className="flex min-h-[28px] items-center gap-2 border-b border-dashed"><span className="w-28 shrink-0 text-muted-foreground">{label}</span>{value || "—"}</div>
  );

  return (
    <div className={DETAIL_PANEL}>
      <Tabs defaultValue={initialTab ?? "info"} className="gap-0">
        <DetailTabsList onActiveTabClick={onClose} variant="line" className={DETAIL_TABS_LIST}>
          <TabsTrigger value="info" className={DETAIL_TAB}>Thông tin</TabsTrigger>
          <TabsTrigger value="shipments" className={DETAIL_TAB}>Lịch sử giao hàng</TabsTrigger>
          <TabsTrigger value="ledger" className={DETAIL_TAB}>Nợ cần thu từ ĐTGH</TabsTrigger>
          <TabsTrigger value="payments" className={DETAIL_TAB}>Lịch sử thanh toán</TabsTrigger>
        </DetailTabsList>
        <TabsContent value="info">
          <div className="grid grid-cols-1 gap-x-8 p-4 text-[13px] md:grid-cols-2">
            <div>{info("Mã đối tác", p.code)}{info("Tên đối tác", <b>{p.name}</b>)}{info("Điện thoại", p.phone)}{info("Email", p.email)}</div>
            <div>{info("Địa chỉ", joinAddress(p.address, p.ward, p.province))}{info("Trạng thái", <StatusBadge tone={p.active ? "green" : "gray"}>{p.active ? "Đang hoạt động" : "Ngừng hoạt động"}</StatusBadge>)}
              {info("Kết nối", "Tự cập nhật trạng thái (chưa tích hợp API hãng vận chuyển)")}{info("Ghi chú", p.note)}</div>
          </div>
          {can("sales.perform") && (
            <div className="flex flex-wrap items-center gap-2 border-t px-4 py-2.5">
              <Button variant="ghost" className={DETAIL_BTN} disabled={remove.isPending}
                onClick={() => confirm(`Xóa đối tác ${p.name}?`) && remove.mutate()}><Trash2 className="size-4" /> Xóa</Button>
              <div className="ml-auto flex gap-2">
                <Button className={DETAIL_BTN} onClick={() => setDialog("reconcile")}><HandCoins className="size-4" /> Đối soát</Button>
                <Button variant="outline" className={DETAIL_BTN} onClick={() => setDialog("pay")}><Wallet className="size-4" /> Thanh toán</Button>
                <Button variant="outline" className={DETAIL_BTN} onClick={() => setDialog("edit")}><Pencil className="size-4" /> Chỉnh sửa</Button>
              </div>
            </div>)}
        </TabsContent>
        <TabsContent value="shipments" className="p-3"><ShipmentTable data={shipments} compact /></TabsContent>
        <TabsContent value="ledger">
          <table className="w-full text-[13px]">
            <thead className={SUB_HEAD}><tr><th>Mã chứng từ</th><th>Thời gian</th><th>Loại</th><th>Ghi chú</th>
              <th className="text-right">Giá trị</th><th className="text-right">Nợ cần thu từ ĐTGH</th></tr></thead>
            <tbody>{!ledger.length && <ListEmptyRow cols={6} what="giao dịch" compact />}
              {ledger.map((l) => (<tr key={l.id} className={ROW}><td><DocCodeLink code={l.docCode} /></td><td>{formatDateTime(l.occurredAt)}</td>
                <td>{LEDGER_LABELS[l.docType]}</td><td>{l.note}</td><td className="text-right">{formatMoney(l.amount)}</td>
                <td className="text-right">{formatMoney(l.balanceAfter)}</td></tr>))}</tbody>
          </table>
        </TabsContent>
        <TabsContent value="payments">
          <table className="w-full text-[13px]">
            <thead className={SUB_HEAD}><tr><th>Mã phiếu</th><th>Thời gian</th><th>Loại</th><th>Người tạo</th><th>Phiếu Sổ quỹ</th>
              <th className="text-right">Số vận đơn</th><th className="text-right">Số tiền</th><th>Trạng thái</th><th /></tr></thead>
            <tbody>{!settlements.length && <ListEmptyRow cols={9} what="phiếu thanh toán" compact />}
              {settlements.map((s) => (<tr key={s.id} className={ROW}><td><DocCodeLink code={s.code} /></td><td>{formatDateTime(s.createdAt)}</td><td>{KIND[s.kind]}</td>
                <td>{s.createdByName}</td><td><DocCodeLink code={s.voucherCode} kind="/cashbook" /></td><td className="text-right">{s.shipmentCount || ""}</td>
                <td className="text-right">{formatMoney(s.amount)}</td>
                <td><StatusBadge tone={s.status === "CANCELLED" ? "red" : "green"}>{s.status === "CANCELLED" ? "Đã hủy" : "Hoàn thành"}</StatusBadge></td>
                <td>{s.status !== "CANCELLED" && can("sales.perform") && <Button size="xs" variant="ghost" disabled={cancel.isPending}
                  onClick={() => confirm(`Hủy phiếu ${s.code}? Phiếu Sổ quỹ ${s.voucherCode ?? ""} sẽ bị hủy, công nợ đối tác được hoàn lại.`) && cancel.mutate(s.id)}>Hủy</Button>}</td>
              </tr>))}</tbody>
          </table>
        </TabsContent>
      </Tabs>
      {dialog === "edit" && <PartnerFormDialog partner={p} onClose={() => setDialog(null)} />}
      {dialog === "pay" && <PartnerPaymentDialog partner={p} onClose={() => setDialog(null)} />}
      {dialog === "reconcile" && <ReconcileDialog partnerId={p.id} onClose={() => setDialog(null)} />}
    </div>
  );
}
