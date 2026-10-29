"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Barcode, Copy, Ellipsis, ExternalLink, FileOutput, Save, Tag, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { docCodeHref, DocCodeLink } from "@/components/ui/doc-code-link";
import { DetailSingleTab } from "@/components/ui/detail-tabs-list";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MAX_LABELS, printBarcodeLabels } from "@/features/print/barcode-label-print";
import type { ProductDetail } from "@/features/products/product-types";
import { Textarea } from "@/components/ui/textarea";
import { useBranches, useShopSettings } from "@/features/settings/settings-queries";
import { api, errorMessage } from "@/lib/api-client";
import { useCurrentUser } from "@/lib/use-current-user";
import { exportReceiptLinesCsv } from "./purchase-csv-export";
import { fromLocalInput, toLocalInput } from "./purchase-line-form";
import { DocStatusBadge, OUTLINE_GRAY_BTN } from "./purchase-list-chrome";
import { useReceipt, useUserLookup } from "./purchase-queries";
import { receiptStatusLabels } from "./purchase-types";
import { ReceiptLinesTable, ReceiptSummary } from "./receipt-lines-table";
import { receiptData } from "@/features/print/print-data";
import { PrintButton } from "@/features/print/print-button";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { purchasesNs } from "@/messages/purchases";

const FIELD = "h-[30px] w-full max-w-[180px] rounded-md border border-[#d1d5db] bg-background px-2 text-[13px] outline-none focus-visible:border-primary disabled:opacity-60";

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[30px] items-center gap-2 text-xs">
      <span className="w-[95px] shrink-0">{label}:</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/**
 * Chi tiết phiếu nhập mở ngay dưới dòng. Sửa được người nhập, ngày nhập, số HĐ, ghi chú (kể cả phiếu đã nhập).
 * Chân như KiotViet: Hủy · Xuất file | Mở phiếu · Lưu · Trả hàng nhập · In tem mã · In · "…" (Sao chép).
 */
export function ReceiptDetailPanel({ id, onClose }: { id: string; onClose?: () => void }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { can } = useCurrentUser();
  const { data: r } = useReceipt(id);
  const { data: users = [] } = useUserLookup();
  const { data: branches = [] } = useBranches();
  const { data: shop } = useShopSettings();
  const [info, setInfo] = useState<{ at: string; receiverId: string; invoiceNo: string; note: string } | null>(null);
  const manage = can("inventory.manage");
  const t = useT(purchasesNs);
  const tc = useT(commonNs);

  const refresh = () => { qc.invalidateQueries({ queryKey: ["purchase-receipts"] }); qc.invalidateQueries({ queryKey: ["purchase-receipt", id] }); };
  const saveInfo = useMutation({
    mutationFn: () => api(`/purchase-receipts/${id}/info`, { method: "PATCH", body: {
      receivedAt: fromLocalInput(info!.at), receiverId: info!.receiverId || null,
      receiverName: users.find((u) => u.id === info!.receiverId)?.fullName, inputInvoiceNo: info!.invoiceNo, note: info!.note } }),
    onSuccess: () => { toast.success(t("detail.toastSaved")); refresh(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const cancel = useMutation({
    mutationFn: () => api(`/purchase-receipts/${id}/cancel`, { method: "POST" }),
    onSuccess: () => { toast.success(t("detail.toastCancelled")); refresh(); qc.invalidateQueries({ queryKey: ["products"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  /** In tem mã: số tem = số lượng nhập (làm tròn lên) mỗi dòng; giá bán lấy theo đơn vị của dòng ở danh mục hàng. */
  const printLabels = useMutation({
    mutationFn: async () => {
      const products = await Promise.all([...new Set(r!.lines.map((l) => l.productId))].map((pid) => api<ProductDetail>(`/products/${pid}`)));
      const unitOf = new Map(products.flatMap((p) => p.units.map((u) => [u.id, { p, u }] as const)));
      return printBarcodeLabels(r!.lines.map((l) => {
        const hit = unitOf.get(l.unitId);
        return { code: l.productCode, barcode: hit?.u.barcode, name: `${l.productName} (${l.unitName})`,
          price: Number(hit?.u.price ?? 0), copies: Math.ceil(Number(l.quantity)) };
      }), shop?.store?.name ?? "");
    },
    onSuccess: (n) => { if (n >= MAX_LABELS) toast.info(tc("errors.labelsCapped", { max: MAX_LABELS })); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (!r) return <div className="border border-primary bg-background p-6 text-sm text-muted-foreground">{tc("status.loading")}</div>;
  const f = info ?? { at: toLocalInput(r.receivedAt), receiverId: r.receiverId ?? "", invoiceNo: r.inputInvoiceNo ?? "", note: r.note ?? "" };
  const setF = (p: Partial<typeof f>) => setInfo({ ...f, ...p });
  const editable = manage && r.status !== "CANCELLED";

  return (
    <div className="border border-primary bg-background text-[13px]">
      <div className="border-b border-[#e5e7eb] px-4">
        <DetailSingleTab onClick={onClose} />
      </div>
      <div className="space-y-4 p-4">
        <div className="flex items-center gap-3">
          <span className="text-base font-bold">{r.code}</span>
          <DocStatusBadge status={r.status} label={receiptStatusLabels(t)[r.status]} />
          <span className="ml-auto">{branches.find((b) => b.id === r.branchId)?.name}</span>
        </div>
        <div className="grid grid-cols-1 gap-x-8 gap-y-1.5 md:grid-cols-3">
          <Info label={tc("fields.createdBy")}>{r.createdByName}</Info>
          <Info label={t("receipts.receiver")}>
            <select aria-label={t("receipts.receiver")} className={FIELD} value={f.receiverId} disabled={!editable} onChange={(e) => setF({ receiverId: e.target.value })}>
              {users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
            </select>
          </Info>
          <Info label={t("detail.receiveDate")}>
            <DateTimePicker aria-label={t("detail.receiveDate")} className={FIELD} value={f.at} disabled={!editable} onChange={(v) => setF({ at: v })} />
          </Info>
          <Info label={t("detail.supplierName")}><span className="block truncate" title={r.supplierName ?? ""}>{r.supplierName && r.supplierCode
            ? <DocCodeLink code={r.supplierName} to={docCodeHref(r.supplierCode) ?? undefined} /> : (r.supplierName ?? "—")}</span></Info>
          <Info label={t("receipts.cols.inputInvoiceNo")}>
            <input aria-label={t("filter.inputInvoiceNo")} className={FIELD} value={f.invoiceNo} disabled={!editable} onChange={(e) => setF({ invoiceNo: e.target.value })} />
          </Info>
        </div>
        <div className="flex justify-end">
          <Link href="/products/price-books" prefetch={false} className="inline-flex items-center gap-1 text-[13px] text-[#2171bc] hover:text-[#1a9dcc] hover:underline">
            <Tag className="size-4" /> {t("detail.priceSetup")}</Link>
        </div>
        <ReceiptLinesTable r={r} />
        <div className="flex items-end gap-6">
          <Textarea className="h-[95px] max-w-[720px] resize-none rounded-md" placeholder={t("detail.notePlaceholder")} value={f.note} disabled={!editable}
            onChange={(e) => setF({ note: e.target.value })} />
          <ReceiptSummary r={r} />
        </div>
      </div>
      {manage && <div className="flex flex-wrap items-center gap-1 border-t border-[#e5e7eb] px-2 py-2.5">
        {r.status !== "CANCELLED" && (
          <Button variant="ghost" disabled={cancel.isPending}
            onClick={() => confirm(t(r.status === "COMPLETED" ? "detail.confirmCancelCompleted" : "detail.confirmCancelDraft", { code: r.code })) && cancel.mutate()}>
            <Trash2 className="size-4" /> {tc("actions.cancel")}</Button>
        )}
        <Button variant="ghost" onClick={() => exportReceiptLinesCsv(r, t)}><FileOutput className="size-4" /> {tc("actions.export")}</Button>
        <div className="ml-auto flex flex-wrap gap-2">
          {r.status === "DRAFT" && (
            <Button className="h-[30px] rounded-md px-3" onClick={() => router.push(`/purchases/receipts/new?edit=${r.id}`)}>
              <ExternalLink className="size-4" /> {t("detail.openDoc")}</Button>
          )}
          {editable && (
            <Button variant="outline" className={OUTLINE_GRAY_BTN} disabled={!info || saveInfo.isPending} onClick={() => saveInfo.mutate()}>
              <Save className="size-4" /> {tc("actions.save")}</Button>
          )}
          {r.status === "COMPLETED" && (
            <Button variant="outline" className={OUTLINE_GRAY_BTN} onClick={() => router.push(`/purchases/returns/new?receiptId=${r.id}`)}>
              <Undo2 className="size-4" /> {t("returns.create")}</Button>
          )}
          <Button variant="outline" className={OUTLINE_GRAY_BTN} disabled={printLabels.isPending || !r.lines.length} onClick={() => printLabels.mutate()}>
            <Barcode className="size-4" /> {tc("actions.printLabels")}</Button>
          <PrintButton type="PURCHASE_RECEIPT" data={receiptData(r)} branchId={r.branchId} />
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex size-[30px] items-center justify-center rounded-md border hover:bg-muted" aria-label={tc("actions.more")}>
              <Ellipsis className="size-4" /></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => router.push(`/purchases/receipts/new?copyFrom=${r.id}`)}><Copy className="size-4" /> {tc("actions.copy")}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>}
    </div>
  );
}
