"use client";

import { CircleCheck, X } from "lucide-react";
import { SupplierPicker } from "@/features/purchases/search-pickers";
import { useT } from "@/lib/i18n";
import { inputInvoicesNs } from "@/messages/input-invoices";

/**
 * Ô "Nhà cung cấp trên hệ thống": NCC khớp MST (✓ xanh, × để bỏ và chọn lại bằng ô tìm); không khớp → tìm NCC khác
 * hoặc "Tạo NCC từ hóa đơn" (MST, tên, địa chỉ người bán).
 */
export function InputInvoiceConfirmSupplier({ value, taxCode, matched, creating, onChange, onCreate }: {
  value: { id: string; name: string } | null; taxCode: string | null; matched: boolean; creating: boolean;
  onChange: (s: { id: string; name: string; taxCode: string | null } | null) => void; onCreate: () => void;
}) {
  const t = useT(inputInvoicesNs);
  if (value) {
    return (
      <div className="flex min-h-8 items-center gap-1.5 border-b border-[#e5e7eb] pb-1 text-[13px]">
        {matched && <CircleCheck className="size-4 shrink-0 text-[#0f9d58]" aria-label={t("confirm.matched")} />}
        <span className="flex-1 truncate">{value.name}{taxCode ? ` - ${taxCode}` : ""}</span>
        <button type="button" className="text-muted-foreground hover:text-foreground" aria-label={t("confirm.clearSupplier")}
          onClick={() => onChange(null)}><X className="size-3.5" /></button>
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <SupplierPicker value={null} onCreate={onCreate} onChange={(s) => onChange(s ? { id: s.id, name: s.name, taxCode: s.taxCode } : null)} />
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{t("confirm.noSupplierMatch")}
        <button type="button" className="font-medium text-primary hover:underline disabled:opacity-50" disabled={creating} onClick={onCreate}>
          {t("confirm.createSupplier")}</button></div>
    </div>
  );
}
