"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { kvDialog, kvDialogBody, kvDialogFooter, kvDialogHeader, kvDialogTitle, kvFooterBtn, kvInput, kvLabel } from "@/features/sales/customer-ui-primitives";
import { SUB_HEAD } from "@/features/sales/invoice-list-kit";
import { api, errorMessage } from "@/lib/api-client";
import { formatDateTime, formatMoney } from "@/lib/format";
import { useCurrentUser } from "@/lib/use-current-user";
import { refreshDelivery, usePartnerOptions, useReconcilable } from "./delivery-queries";
import { shipmentStatusLabel, type SettlementResult } from "./delivery-types";

export const FUNDS: [string, string][] = [["CASH", "Tiền mặt"], ["BANK", "Ngân hàng"], ["EWALLET", "Ví điện tử"]];
const SELECT = `${kvInput} w-full border bg-background px-2`;

/**
 * Đối soát với đối tác giao hàng: chọn vận đơn đã kết thúc (Giao thành công / Đã chuyển hoàn) chưa đối soát →
 * chênh lệch = Σ thu hộ − Σ phí cửa hàng chịu → 1 phiếu thu (đối tác trả) hoặc phiếu chi (cửa hàng trả) ở Sổ quỹ.
 */
export function ReconcileDialog({ partnerId: initial, onClose }: { partnerId?: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: me } = useCurrentUser();
  const branches = me?.user.branches ?? [];
  const { data: partners = [] } = usePartnerOptions();
  const [partnerId, setPartnerId] = useState(initial ?? "");
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [fund, setFund] = useState("CASH");
  const [note, setNote] = useState("");
  const { data: rows = [] } = useReconcilable(partnerId, branchId);
  const [picked, setPicked] = useState<string[]>([]);
  useEffect(() => { setPicked(rows.map((r) => r.id)); }, [rows]);
  useEffect(() => { if (!branchId && branches[0]) setBranchId(branches[0].id); }, [branchId, branches]);

  const chosen = rows.filter((r) => picked.includes(r.id));
  const sum = (f: (r: (typeof rows)[number]) => number) => chosen.reduce((s, r) => s + Number(f(r)), 0);
  const net = sum((r) => r.net);
  const save = useMutation({
    mutationFn: () => api<SettlementResult>(`/delivery-partners/${partnerId}/reconcile`, { method: "POST",
      body: { branchId, shipmentIds: picked, fund, note: note || null } }),
    onSuccess: (r) => {
      toast.success(`Đã đối soát ${picked.length} vận đơn (${r.code})${r.voucherCode ? ` — phiếu ${r.voucherCode} ${formatMoney(Math.abs(r.amount))}` : ""}`);
      refreshDelivery(qc);
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={`${kvDialog} sm:max-w-[820px]`}>
        <DialogHeader className={kvDialogHeader}><DialogTitle className={kvDialogTitle}>Đối soát với đối tác giao hàng</DialogTitle></DialogHeader>
        <div className={kvDialogBody}>
          <div className="grid grid-cols-3 gap-3">
            <label className="space-y-1"><span className={kvLabel}>Đối tác giao hàng</span>
              <select className={SELECT} value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
                <option value="">Chọn đối tác</option>{partners.map((p) => <option key={p.id} value={p.id}>{p.code} - {p.name}</option>)}</select></label>
            <label className="space-y-1"><span className={kvLabel}>Chi nhánh</span>
              <select className={SELECT} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
            <label className="space-y-1"><span className={kvLabel}>Quỹ thu / chi</span>
              <select className={SELECT} value={fund} onChange={(e) => setFund(e.target.value)}>
                {FUNDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          </div>
          <div className="max-h-[320px] overflow-y-auto rounded-md border">
            <table className="w-full text-[13px]">
              <thead className={SUB_HEAD}><tr>
                <th><input type="checkbox" aria-label="Chọn tất cả" className="accent-primary" checked={!!rows.length && picked.length === rows.length}
                  onChange={(e) => setPicked(e.target.checked ? rows.map((r) => r.id) : [])} /></th>
                <th>Mã vận đơn</th><th>Hóa đơn</th><th>Người nhận</th><th>Trạng thái</th><th>Hoàn tất</th>
                <th className="text-right">Thu hộ</th><th className="text-right">Phí cửa hàng trả</th><th className="text-right">Còn lại</th></tr></thead>
              <tbody>
                {!rows.length && <tr><td colSpan={9} className="py-6 text-center text-muted-foreground">{partnerId ? "Không có vận đơn chờ đối soát" : "Chọn đối tác giao hàng"}</td></tr>}
                {rows.map((r) => (
                  <tr key={r.id} className="border-b [&_td]:h-[30px] [&_td]:px-2">
                    <td><input type="checkbox" aria-label={`Chọn ${r.code}`} className="accent-primary" checked={picked.includes(r.id)}
                      onChange={(e) => setPicked(e.target.checked ? [...picked, r.id] : picked.filter((x) => x !== r.id))} /></td>
                    <td>{r.code}</td><td>{r.invoiceCode}</td><td>{r.receiverName}</td><td>{shipmentStatusLabel(r.status)}</td>
                    <td>{r.deliveredAt ? formatDateTime(r.deliveredAt) : ""}</td><td className="text-right">{formatMoney(r.cod)}</td>
                    <td className="text-right">{formatMoney(r.fee)}</td><td className="text-right">{formatMoney(r.net)}</td>
                  </tr>))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-6 text-[13px]">
            <span>Tổng thu hộ: <b>{formatMoney(sum((r) => r.cod))}</b></span><span>Tổng phí: <b>{formatMoney(sum((r) => r.fee))}</b></span>
            <span className="text-[15px]">{net >= 0 ? "Đối tác cần trả cửa hàng" : "Cửa hàng cần trả đối tác"}: <b className="text-primary">{formatMoney(Math.abs(net))}</b></span>
          </div>
          <input className={`${kvInput} w-full border px-2`} placeholder="Ghi chú" aria-label="Ghi chú" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <DialogFooter className={kvDialogFooter}>
          <Button variant="outline" className={kvFooterBtn} onClick={onClose}>Bỏ qua</Button>
          <Button className={kvFooterBtn} disabled={save.isPending || !partnerId || !picked.length} onClick={() => save.mutate()}>Đối soát</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
