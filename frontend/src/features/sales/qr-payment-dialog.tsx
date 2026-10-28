"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/number-input";
import { NativeSelect } from "@/features/products/product-form-sections";
import { api, errorMessage } from "@/lib/api-client";
import { useBankAccounts } from "./sales-queries";

type Props = { amount: number; info?: string; onClose: () => void };
type Qr = { payload: string; bankName: string; accountNo: string; accountName: string };

/** "Thanh toán qua mã QR": VietQR (NAPAS 247) theo tài khoản + số tiền; mọi app ngân hàng quét được. */
export function QrPaymentDialog({ amount: initial, info, onClose }: Props) {
  const { data: banks = [] } = useBankAccounts();
  const [bankId, setBankId] = useState("");
  const [amount, setAmount] = useState(initial);
  const [qr, setQr] = useState<Qr | null>(null);
  const [image, setImage] = useState("");
  const account = bankId || banks[0]?.id || "";

  useEffect(() => {
    if (!account) return;
    const t = setTimeout(async () => {
      try {
        const q = await api<Qr>(`/bank-accounts/${account}/vietqr?amount=${Math.round(amount)}&info=${encodeURIComponent(info ?? "")}`);
        setQr(q);
        setImage(await QRCode.toDataURL(q.payload, { width: 320, margin: 1, errorCorrectionLevel: "M" }));
      } catch (e) {
        setQr(null);
        setImage("");
        toast.error(errorMessage(e));
      }
    }, 300);
    return () => clearTimeout(t);
  }, [account, amount, info]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Thanh toán qua mã QR</DialogTitle></DialogHeader>
        {!banks.length ? (
          <p className="text-sm text-muted-foreground">Chưa có tài khoản ngân hàng — thêm tại Thiết lập → Tài khoản ngân hàng.</p>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-1.5"><Label>Tài khoản</Label>
              <NativeSelect value={account} onChange={(e) => setBankId(e.target.value)}>
                {banks.map((b) => <option key={b.id} value={b.id}>{b.bankName} - {b.accountNo} - {b.accountName}</option>)}
              </NativeSelect></div>
            <div className="grid gap-1.5"><Label>Số tiền</Label><NumberInput value={amount} onValueChange={setAmount} /></div>
            <div className="flex items-center gap-4 rounded-lg bg-primary p-4 text-primary-foreground">
              <div className="flex size-36 shrink-0 items-center justify-center rounded-md bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element -- QR data URL */}
                {image ? <img src={image} alt="Mã QR chuyển khoản" className="size-34" /> : <span className="text-xs text-muted-foreground">Đang tạo...</span>}
              </div>
              <div className="space-y-1 text-sm">
                <div className="font-bold uppercase">{qr?.accountName}</div>
                <div>{qr?.accountNo}</div>
                <div>{qr?.bankName}</div>
              </div>
            </div>
            <div className="flex justify-center gap-2">
              <Button variant="outline" size="sm" disabled={!image} render={<a href={image} download={`QR-${qr?.accountNo}-${Math.round(amount)}.png`} />}>
                <Download className="size-4" /> Tải QR</Button>
              <Button variant="outline" size="sm" disabled={!qr}
                onClick={() => navigator.clipboard.writeText(qr!.payload).then(() => toast.success("Đã sao chép mã QR"))}>
                <Copy className="size-4" /> Sao chép QR</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
