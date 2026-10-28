"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import QRCode from "qrcode";
import { CircleCheck, Copy, Download, Lightbulb, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/number-input";
import { api, errorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { kvDialog, kvDialogBody, kvDialogHeader, kvDialogTitle, kvInput, kvLabel } from "./customer-ui-primitives";
import { useBankAccounts } from "./sales-queries";

/** onPaid: có thì dùng báo có SePay (nếu đã bật) — gọi khi ngân hàng báo đã nhận đủ tiền. */
type Props = { amount: number; info?: string; onClose: () => void; onPaid?: (paidAmount: number, autoComplete: boolean) => void };
type Qr = { payload: string; bankName: string; accountNo: string; accountName: string };
type PayRequest = { code: string; amount: number; paidAmount: number; status: "PENDING" | "PAID"; autoComplete: boolean };

/**
 * "Thanh toán qua mã QR": VietQR (NAPAS 247) theo tài khoản + số tiền; mọi app ngân hàng quét được.
 * Khi bật SePay: nội dung chuyển khoản là mã VXC... để tự khớp giao dịch, màn hình tự báo "Đã nhận tiền".
 */
export function QrPaymentDialog({ amount: initial, info, onClose, onPaid }: Props) {
  const { data: banks = [] } = useBankAccounts();
  const { data: sepay } = useQuery({ queryKey: ["sepay-settings"], queryFn: () => api<{ enabled: boolean }>("/payments/sepay/settings") });
  const [bankId, setBankId] = useState("");
  const [amount, setAmount] = useState(initial);
  const [qr, setQr] = useState<Qr | null>(null);
  const [image, setImage] = useState("");
  const [request, setRequest] = useState<PayRequest | null>(null);
  const account = bankId || banks[0]?.id || "";
  const autoMatch = Boolean(onPaid && sepay?.enabled);

  // Có báo có: theo dõi trạng thái yêu cầu thanh toán mỗi 3 giây cho tới khi nhận đủ tiền
  useEffect(() => {
    if (!request || request.status === "PAID") return;
    const timer = setInterval(async () => {
      try {
        const r = await api<PayRequest>(`/payment-requests/${request.code}`);
        if (r.status === "PAID") {
          setRequest(r);
          toast.success(`Đã nhận ${Number(r.paidAmount).toLocaleString("vi-VN")}đ chuyển khoản`);
          onPaid?.(Number(r.paidAmount), r.autoComplete);
        }
      } catch { /* mất mạng tạm thời: thử lại lần sau */ }
    }, 3000);
    return () => clearInterval(timer);
  }, [request, onPaid]);

  useEffect(() => {
    if (!account || sepay === undefined) return;
    const t = setTimeout(async () => {
      try {
        let content = info ?? "";
        if (autoMatch && Math.round(amount) >= 1000) {
          const r = await api<PayRequest>("/payment-requests", { method: "POST", body: { amount: Math.round(amount), reference: info } });
          setRequest(r);
          content = r.code;
        }
        const q = await api<Qr>(`/bank-accounts/${account}/vietqr?amount=${Math.round(amount)}&info=${encodeURIComponent(content)}`);
        setQr(q);
        setImage(await QRCode.toDataURL(q.payload, { width: 320, margin: 1, errorCorrectionLevel: "M" }));
      } catch (e) {
        setQr(null);
        setImage("");
        toast.error(errorMessage(e));
      }
    }, 300);
    return () => clearTimeout(t);
  }, [account, amount, info, autoMatch, sepay]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={cn(kvDialog, "sm:max-w-[360px]")}>
        <DialogHeader className={kvDialogHeader}><DialogTitle className={kvDialogTitle}>Thanh toán qua mã QR</DialogTitle></DialogHeader>
        {!banks.length ? (
          <p className="px-5 pb-5 text-[13px] text-muted-foreground">Chưa có tài khoản ngân hàng — thêm tại Thiết lập → Tài khoản ngân hàng.</p>
        ) : (
          <div className={cn(kvDialogBody, "pb-5")}>
            <div className="grid gap-1.5"><Label className={kvLabel}>Tài khoản</Label>
              <select className="h-8 w-full truncate rounded-md border border-[#d9dbe0] bg-white px-2.5 text-[13px] outline-none focus:border-primary"
                aria-label="Tài khoản" value={account} onChange={(e) => setBankId(e.target.value)}>
                {banks.map((b) => <option key={b.id} value={b.id}>{b.bankName} - {b.accountNo} - {b.accountName}</option>)}
              </select></div>
            <div className="grid gap-1.5"><Label className={kvLabel}>Số tiền</Label>
              <NumberInput aria-label="Số tiền" className={cn(kvInput, "text-left")} value={amount} onValueChange={setAmount} /></div>
            <div className="flex items-center gap-5 rounded-lg bg-[#004a9f] p-4 text-white">
              <div className="flex size-[112px] shrink-0 items-center justify-center rounded-md bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element -- QR data URL */}
                {image ? <img src={image} alt="Mã QR chuyển khoản" className="size-[104px]" /> : <span className="text-[12px] text-muted-foreground">Đang tạo...</span>}
              </div>
              <div className="min-w-0 space-y-1.5 text-[12px]">
                <div className="text-[13px] font-bold uppercase">{qr?.accountName}</div>
                <div>{qr?.accountNo}</div>
                <div>{qr?.bankName}</div>
              </div>
            </div>
            {autoMatch && request && (
              request.status === "PAID"
                ? <p className="flex items-center justify-center gap-2 font-semibold text-green-600"><CircleCheck className="size-5" /> Đã nhận tiền</p>
                : <p className="flex items-center justify-center gap-2 text-[12px] text-muted-foreground">
                    <LoaderCircle className="size-4 animate-spin" /> Đang chờ khách chuyển khoản (nội dung {request.code})</p>
            )}
            <div className="flex items-center justify-center gap-2 text-[13px]">
              <Button variant="outline" size="sm" className="h-7 rounded-md text-[12px]" disabled={!image}
                render={<a href={image} download={`QR-${qr?.accountNo}-${Math.round(amount)}.png`} />}>
                <Download className="size-3.5" /> Tải QR</Button>
              <span>hoặc</span>
              <Button variant="outline" size="sm" className="h-7 rounded-md text-[12px]" disabled={!qr}
                onClick={() => navigator.clipboard.writeText(qr!.payload).then(() => toast.success("Đã sao chép mã QR"))}>
                <Copy className="size-3.5" /> Sao chép QR</Button>
            </div>
            {autoMatch && (
              <p className="flex gap-2 text-[12px] text-primary"><Lightbulb className="mt-0.5 size-4 shrink-0" />
                Đã bật nhận thông báo thanh toán QR. Hệ thống sẽ tự xác nhận khi nhận được tiền chuyển khoản.</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
