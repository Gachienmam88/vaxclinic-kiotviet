"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NumberInput } from "@/components/number-input";
import { NativeSelect } from "@/features/products/product-form-sections";
import { kvDialog, kvDialogFooter, kvDialogHeader, kvDialogTitle, kvFooterBtn } from "@/features/sales/customer-ui-primitives";
import { api, errorMessage } from "@/lib/api-client";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { InputInvoice } from "./integration-queries";
import { baseUnit, buildConfirmRows, rowAmount, type ConfirmRow } from "./input-invoice-confirm-rows";
import { InputInvoiceConfirmSupplier } from "./input-invoice-confirm-supplier";
import { InputInvoiceProductPicker } from "./input-invoice-product-picker";
import { findSupplierByTaxCode, invoiceReceiptNote, saveInputInvoiceReceiptDraft } from "./input-invoice-receipt-draft";
import { createSupplierFromSeller } from "./input-invoice-supplier-match";
import { useT } from "@/lib/i18n";
import { inputInvoicesNs } from "@/messages/input-invoices";

type Sup = { id: string; name: string; taxCode: string | null };
const TH = "h-[34px] px-2 text-left text-xs font-bold whitespace-nowrap";
const NUM = "h-8 w-[100px] rounded-md text-right";

/**
 * "Xác nhận dữ liệu từ hóa đơn điện tử" (KiotViet): NCC trên hóa đơn ↔ NCC trong hệ thống (khớp MST), mỗi dòng hóa đơn ↔
 * hàng hóa + ĐVT trong kho (nhớ ánh xạ theo MST người bán). "Tạo phiếu nhập" chỉ khi mọi dòng còn lại đã chọn hàng.
 */
export function InputInvoiceConfirmDialog({ invoice, onClose }: { invoice: InputInvoice; onClose: () => void }) {
  const router = useRouter();
  const qc = useQueryClient();
  const t = useT(inputInvoicesNs);
  const [inv, setInv] = useState<InputInvoice | null>(null);
  const [rows, setRows] = useState<ConfirmRow[] | null>(null);
  const [supplier, setSupplier] = useState<Sup | null>(null);
  const [matched, setMatched] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const full = await api<InputInvoice>(`/input-invoices/${invoice.id}`);
      const [r, s] = await Promise.all([buildConfirmRows(full), findSupplierByTaxCode(full.sellerTaxCode)]);
      if (!alive) return;
      setInv(full);
      setRows(r);
      if (s) { setSupplier({ id: s.id, name: s.name, taxCode: s.taxCode }); setMatched(true); }
    })().catch((e) => { toast.error(errorMessage(e)); onClose(); });
    return () => { alive = false; };
  }, [invoice.id, onClose]);

  const createSupplier = useMutation({
    mutationFn: () => createSupplierFromSeller(inv ?? invoice),
    onSuccess: (s) => { setSupplier({ id: s.id, name: s.name, taxCode: s.taxCode }); setMatched(true); toast.success(t("confirm.toastSupplierCreated", { code: s.code })); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const submit = useMutation({
    mutationFn: async () => {
      const r = rows ?? [];
      await api("/input-invoices/item-mappings", { method: "PUT", body: { sellerTaxCode: inv!.sellerTaxCode,
        items: r.map((x) => ({ itemName: x.line.name, itemUnit: x.line.unit, productId: x.product!.id, unitId: x.unitId })) } });
      saveInputInvoiceReceiptDraft({ invoiceId: inv!.id, supplier: supplier ? { id: supplier.id, name: supplier.name } : null,
        inputInvoiceNo: inv!.number, note: invoiceReceiptNote(inv!),
        lines: r.map((x) => ({ productId: x.product!.id, unitId: x.unitId, quantity: x.quantity, unitPrice: x.unitPrice,
          discount: x.discount, vatRate: x.vatRate })) });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["input-invoices"] }); router.push(`/purchases/receipts/new?source=inputInvoice&id=${inv!.id}`); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const update = (key: number, patch: Partial<ConfirmRow>) => setRows((rs) => rs && rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const unmapped = (rows ?? []).filter((r) => !r.product);
  function onSubmit() {
    setShowErrors(true);
    if (!rows?.length) return toast.error(t("confirm.noLines"));
    if (unmapped.length) return;
    submit.mutate();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={cn(kvDialog, "flex max-h-[92vh] flex-col sm:max-w-[900px]")}>
        <DialogHeader className={kvDialogHeader}><DialogTitle className={kvDialogTitle}>{t("confirm.title")}</DialogTitle></DialogHeader>
        {!inv || !rows ? <div className="px-5 py-10 text-center text-[13px] text-muted-foreground">{t("common.loading")}</div> : (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-4">
            <div className="grid grid-cols-1 gap-x-8 gap-y-3 md:grid-cols-2">
              <div className="space-y-1.5"><div className="text-xs">{t("confirm.sellerOnInvoice")}</div>
                <div className="border-b border-[#e5e7eb] pb-1 text-[13px]">{inv.sellerName ?? ""} - {inv.sellerTaxCode}</div></div>
              <div className="space-y-1.5"><div className="text-xs">{t("confirm.supplierOnSystem")}</div>
                <InputInvoiceConfirmSupplier value={supplier} taxCode={supplier?.taxCode ?? null} matched={matched} creating={createSupplier.isPending}
                  onChange={(s) => { setSupplier(s); setMatched(false); }} onCreate={() => createSupplier.mutate()} /></div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-[13px]">
                <thead className="bg-[#eff0f3]"><tr>
                  <th className={TH}>{t("confirm.colInvoiceItem")}</th><th className={TH}>{t("confirm.colSystemItem")}</th>
                  <th className={TH}>{t("confirm.colUnit")}</th><th className={cn(TH, "text-right")}>{t("confirm.colQty")}</th>
                  <th className={cn(TH, "text-right")}>{t("confirm.colPrice")}</th><th className={cn(TH, "text-right")}>{t("confirm.colDiscount")}</th>
                  <th className={cn(TH, "text-right")}>{t("confirm.colAmount")}</th><th className="w-8" /></tr></thead>
                <tbody>{rows.map((r) => {
                  const bad = showErrors && !r.product;
                  return (
                    <tr key={r.key} className={cn("border-b border-[#e5e7eb] align-top [&_td]:px-2 [&_td]:py-2", bad && "bg-[#fff5f5] outline outline-1 -outline-offset-1 outline-destructive")}>
                      <td className="max-w-[200px]">{r.line.name}{r.line.unit ? ` (${r.line.unit})` : ""}</td>
                      <td><InputInvoiceProductPicker value={r.product} unitId={r.unitId} invalid={bad}
                        onPick={(p) => update(r.key, { product: p, unitId: baseUnit(p) })} onClear={() => update(r.key, { product: null, unitId: "" })} /></td>
                      <td><NativeSelect aria-label={t("confirm.colUnit")} className="w-[110px]" value={r.unitId} disabled={!r.product}
                        onChange={(e) => update(r.key, { unitId: e.target.value })}>
                        {r.product?.units.map((u) => <option key={u.id} value={u.id}>{u.unitName}</option>)}</NativeSelect></td>
                      <td><NumberInput aria-label={t("confirm.colQty")} className={NUM} value={r.quantity} onValueChange={(quantity) => update(r.key, { quantity })} /></td>
                      <td><NumberInput aria-label={t("confirm.colPrice")} className={NUM} value={r.unitPrice} onValueChange={(unitPrice) => update(r.key, { unitPrice })} /></td>
                      <td><NumberInput aria-label={t("confirm.colDiscount")} className={NUM} value={r.discount} onValueChange={(discount) => update(r.key, { discount })} /></td>
                      <td className="text-right leading-8">{formatMoney(rowAmount(r))}</td>
                      <td><button type="button" aria-label={t("confirm.removeLine")} className="flex h-8 items-center text-muted-foreground hover:text-destructive"
                        onClick={() => setRows((rs) => rs && rs.filter((x) => x.key !== r.key))}><Trash2 className="size-4" /></button></td>
                    </tr>);
                })}</tbody>
              </table>
            </div>
            {showErrors && unmapped.length > 0 && <p role="alert" className="text-[13px] text-destructive">{t("confirm.unmappedError")}</p>}
          </div>
        )}
        <DialogFooter className={kvDialogFooter}>
          <Button variant="outline" className={kvFooterBtn} onClick={onClose}>{t("common.skip")}</Button>
          <Button className={kvFooterBtn} disabled={!rows || submit.isPending} onClick={onSubmit}>{t("confirm.submit")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
