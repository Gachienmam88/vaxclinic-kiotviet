"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SupplierPaymentDialog } from "@/features/purchases/supplier-payment-dialog";
import type { SupplierRow } from "@/features/purchases/supplier-types";
import { errorMessage } from "@/lib/api-client";
import { linkInputInvoice, type InputInvoice } from "./integration-queries";
import type { CreateKind } from "./input-invoice-create-menu";
import { InputInvoiceConfirmDialog } from "./input-invoice-confirm-dialog";
import { InputInvoiceServiceVoucherDialog } from "./input-invoice-service-voucher-dialog";
import { ensureSupplierRow } from "./input-invoice-supplier-match";
import { useT } from "@/lib/i18n";
import { inputInvoicesNs } from "@/messages/input-invoices";

/**
 * Mở đúng màn theo lựa chọn "Lập phiếu ▾": phiếu nhập (xác nhận dữ liệu HĐĐT), phiếu mua dịch vụ (phiếu chi Sổ quỹ),
 * phiếu chi tiền mặt / chuyển khoản / ví (thanh toán NCC theo MST, ghi công nợ NCC). Lưu xong → gắn "Đã lập phiếu".
 */
export function InputInvoiceCreateFlow({ inv, kind, onClose }: { inv: InputInvoice; kind: CreateKind; onClose: () => void }) {
  if (kind === "RECEIPT") return <InputInvoiceConfirmDialog invoice={inv} onClose={onClose} />;
  if (kind === "SERVICE") return <InputInvoiceServiceVoucherDialog inv={inv} onClose={onClose} />;
  return <SupplierPaymentFlow inv={inv} method={kind} onClose={onClose} />;
}

function SupplierPaymentFlow({ inv, method, onClose }: { inv: InputInvoice; method: "CASH" | "TRANSFER" | "EWALLET"; onClose: () => void }) {
  const qc = useQueryClient();
  const t = useT(inputInvoicesNs);
  const [supplier, setSupplier] = useState<SupplierRow | null>(null);

  useEffect(() => {
    let alive = true;
    ensureSupplierRow(inv, () => confirm(t("create.noSupplierConfirm", { name: inv.sellerName ?? "", taxCode: inv.sellerTaxCode })))
      .then((s) => { if (!alive) return; if (s) setSupplier(s); else onClose(); })
      .catch((e) => { toast.error(errorMessage(e)); onClose(); });
    return () => { alive = false; };
    // chỉ chạy 1 lần khi mở
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!supplier) return null;
  return (
    <SupplierPaymentDialog kind="payment" supplier={supplier} onClose={onClose} initialMethod={method} initialAmount={Number(inv.total)}
      initialNote={`Thanh toán hóa đơn đầu vào ${inv.series} số ${inv.number}`}
      onSaved={(doc) => {
        linkInputInvoice(inv.id, "SUPPLIER_PAYMENT", doc.id, doc.code)
          .then(() => qc.invalidateQueries({ queryKey: ["input-invoices"] }))
          .catch((e) => toast.error(t("create.linkFailed", { error: errorMessage(e) })));
      }} />
  );
}
