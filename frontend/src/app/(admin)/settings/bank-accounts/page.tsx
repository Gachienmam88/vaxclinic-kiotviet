"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, QrCode, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/features/products/product-form-sections";
import { QrPaymentDialog } from "@/features/sales/qr-payment-dialog";
import { useBankAccounts } from "@/features/sales/sales-queries";
import { api, errorMessage } from "@/lib/api-client";

/** Mã BIN (NAPAS) các ngân hàng phổ biến — dùng tạo VietQR. Ngân hàng khác: nhập BIN tay. */
const BANKS = [
  ["VietinBank", "970415"], ["Vietcombank", "970436"], ["BIDV", "970418"], ["Agribank", "970405"], ["MB Bank", "970422"],
  ["Techcombank", "970407"], ["ACB", "970416"], ["VPBank", "970432"], ["TPBank", "970423"], ["Sacombank", "970403"],
] as const;

/** Thiết lập → Tài khoản ngân hàng nhận chuyển khoản (quỹ Ngân hàng, mã QR). */
export default function BankAccountsPage() {
  const qc = useQueryClient();
  const { data: banks = [] } = useBankAccounts();
  const [f, setF] = useState({ bankName: "VietinBank", bankBin: "970415", accountNo: "", accountName: "" });
  const [preview, setPreview] = useState(false);
  const add = useMutation({
    mutationFn: () => api("/bank-accounts", { method: "POST", body: f }),
    onSuccess: () => { toast.success("Đã thêm tài khoản"); setF({ ...f, accountNo: "", accountName: "" }); qc.invalidateQueries({ queryKey: ["bank-accounts"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/bank-accounts/${id}/deactivate`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bank-accounts"] }),
  });

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-xl font-bold">Tài khoản ngân hàng</h1>
      <div className="space-y-2 rounded-lg bg-background p-4 text-sm">
        {!banks.length && <p className="text-muted-foreground">Chưa có tài khoản nào.</p>}
        {banks.map((b) => (
          <div key={b.id} className="flex items-center gap-3 border-b py-2 last:border-0">
            <b>{b.bankName}</b><span>{b.accountNo}</span><span className="text-muted-foreground">{b.accountName}</span>
            {!b.bankBin && <span className="text-xs text-destructive">thiếu mã BIN — không tạo được QR</span>}
            <Button size="sm" variant="ghost" className="ml-auto text-destructive" onClick={() => confirm(`Ngừng dùng tài khoản ${b.accountNo}?`) && remove.mutate(b.id)}>
              <Trash2 className="size-4" /></Button>
          </div>
        ))}
        {banks.length > 0 && <Button size="sm" variant="outline" onClick={() => setPreview(true)}><QrCode className="size-4" /> Thử tạo QR</Button>}
      </div>
      <div className="grid grid-cols-1 gap-3 rounded-lg bg-background p-4 text-sm md:grid-cols-2">
        <div className="grid gap-1.5"><Label>Ngân hàng</Label>
          <NativeSelect value={f.bankName} onChange={(e) => setF({ ...f, bankName: e.target.value, bankBin: BANKS.find(([n]) => n === e.target.value)?.[1] ?? "" })}>
            {BANKS.map(([n]) => <option key={n}>{n}</option>)}</NativeSelect></div>
        <div className="grid gap-1.5"><Label>Mã BIN (NAPAS)</Label><Input value={f.bankBin} onChange={(e) => setF({ ...f, bankBin: e.target.value })} /></div>
        <div className="grid gap-1.5"><Label>Số tài khoản</Label><Input value={f.accountNo} onChange={(e) => setF({ ...f, accountNo: e.target.value })} /></div>
        <div className="grid gap-1.5"><Label>Tên chủ tài khoản</Label><Input value={f.accountName} onChange={(e) => setF({ ...f, accountName: e.target.value })} /></div>
        <div className="md:col-span-2 flex justify-end">
          <Button disabled={!f.accountNo || !f.accountName || add.isPending} onClick={() => add.mutate()}><Plus className="size-4" /> Thêm tài khoản</Button>
        </div>
      </div>
      {preview && <QrPaymentDialog amount={10000} info="Thu thu QR" onClose={() => setPreview(false)} />}
    </div>
  );
}
