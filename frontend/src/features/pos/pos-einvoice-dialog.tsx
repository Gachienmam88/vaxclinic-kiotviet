"use client";

import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import type { Customer } from "@/features/sales/sales-types";
import type { EInvoiceBuyer, PosCustomer } from "./pos-types";

const EMPTY: EInvoiceBuyer = { buyerName: "", companyName: "", taxCode: "", address: "", email: "", phone: "" };
const FIELDS: [keyof EInvoiceBuyer, string][] = [
  ["buyerName", "Tên người mua"], ["companyName", "Tên đơn vị"], ["taxCode", "Mã số thuế"], ["address", "Địa chỉ"],
  ["email", "Email"], ["phone", "Số điện thoại"],
];

/** Người mua có điền gì không (tất cả trống = không xuất thông tin riêng). */
export const hasBuyer = (b: EInvoiceBuyer | null | undefined) => !!b && Object.values(b).some((v) => v.trim());

/** Ô "Thông tin xuất HĐĐT · Chi tiết" ở đáy cột trái: mở hộp thoại nhập thông tin người mua (lưu trên hóa đơn). */
export function PosEInvoiceBox({ value, customer, onChange }: {
  value: EInvoiceBuyer | null | undefined; customer: PosCustomer | null; onChange: (v: EInvoiceBuyer | null) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="flex h-[46px] shrink-0 items-center gap-1.5 rounded-lg bg-background px-3 text-[13px] shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
        <FileText className="size-4 fill-[#1f2329] text-white" />
        <span className={hasBuyer(value) ? "font-medium" : ""}>Thông tin xuất HĐĐT</span>
        <button type="button" className="ml-1 text-primary hover:underline" onClick={() => setOpen(true)}>Chi tiết</button>
      </div>
      {open && <EInvoiceDialog value={value} customer={customer} onClose={() => setOpen(false)} onSave={onChange} />}
    </>
  );
}

function EInvoiceDialog({ value, customer, onSave, onClose }: {
  value: EInvoiceBuyer | null | undefined; customer: PosCustomer | null; onSave: (v: EInvoiceBuyer | null) => void; onClose: () => void;
}) {
  const [f, setF] = useState<EInvoiceBuyer>(value ?? EMPTY);
  // Chưa nhập gì + có khách: lấy thông tin xuất hóa đơn đã lưu ở hồ sơ khách (cần mạng; mất mạng thì nhập tay)
  useEffect(() => {
    if (hasBuyer(value) || !customer) return;
    api<Customer>(`/customers/${customer.id}`).then((c) => setF({
      buyerName: c.buyerName ?? c.name ?? "", companyName: c.companyName ?? "", taxCode: c.taxCode ?? "",
      address: c.invoiceAddress ?? c.address ?? "", email: c.invoiceEmail ?? c.email ?? "", phone: c.invoicePhone ?? c.phone ?? "",
    })).catch(() => undefined);
  }, [value, customer]);
  const emailBad = !!f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim());
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-4 p-6 text-[13px] sm:max-w-[520px]">
        <DialogHeader><DialogTitle className="text-[15px] font-bold">Thông tin xuất hóa đơn điện tử</DialogTitle></DialogHeader>
        <div className="grid grid-cols-[120px_1fr] items-center gap-x-3 gap-y-2.5">
          {FIELDS.map(([k, label]) => (
            <label key={k} className="contents">{label}
              <Input aria-label={label} value={f[k]} maxLength={k === "taxCode" || k === "phone" ? 20 : k === "address" ? 500 : 250}
                onChange={(e) => setF({ ...f, [k]: e.target.value })} className="h-8 text-[13px]" />
            </label>
          ))}
        </div>
        {emailBad && <p className="text-destructive">Email không hợp lệ</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" className="h-9 border-primary px-5 text-primary" onClick={onClose}>Bỏ qua</Button>
          <Button className="h-9 px-6" disabled={emailBad} onClick={() => { onSave(hasBuyer(f) ? f : null); onClose(); }}>Lưu</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
