"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/features/products/product-form-sections";
import type { BankAccount } from "@/features/sales/sales-types";
import { api, errorMessage } from "@/lib/api-client";

/** Mã BIN (NAPAS) các ngân hàng phổ biến — dùng tạo VietQR. Ngân hàng khác: nhập BIN tay. */
export const BANKS = [
  ["VietinBank", "970415"], ["Vietcombank", "970436"], ["BIDV", "970418"], ["Agribank", "970405"], ["MB Bank", "970422"],
  ["Techcombank", "970407"], ["ACB", "970416"], ["VPBank", "970432"], ["TPBank", "970423"], ["Sacombank", "970403"],
  ["VIB", "970441"], ["SHB", "970443"], ["HDBank", "970437"], ["OCB", "970448"], ["SeABank", "970440"],
] as const;
const WALLETS = ["MoMo", "ZaloPay", "VNPay", "ShopeePay", "Viettel Money"];

/** Thêm / sửa tài khoản thu chi: ngân hàng (có mã BIN để tạo VietQR) hoặc ví điện tử. */
export function MoneyAccountDialog({ kind, account, onClose }: { kind: "BANK" | "EWALLET"; account?: BankAccount; onClose: () => void }) {
  const qc = useQueryClient();
  const bank = kind === "BANK";
  const [f, setF] = useState({
    bankName: account?.bankName ?? (bank ? "VietinBank" : "MoMo"), bankBin: account?.bankBin ?? (bank ? "970415" : ""),
    accountNo: account?.accountNo ?? "", accountName: account?.accountName ?? "", note: account?.note ?? "",
  });
  const save = useMutation({
    mutationFn: () => api(account ? `/bank-accounts/${account.id}` : "/bank-accounts", { method: account ? "PUT" : "POST", body: { ...f, kind } }),
    onSuccess: () => { toast.success(account ? "Đã cập nhật tài khoản" : "Đã thêm tài khoản"); qc.invalidateQueries({ queryKey: ["bank-accounts"] }); onClose(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const bind = (k: keyof typeof f) => ({ value: f[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value }) });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{account ? "Sửa" : "Thêm"} {bank ? "tài khoản ngân hàng" : "ví điện tử"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="grid gap-1.5"><Label>{bank ? "Ngân hàng" : "Ví điện tử"}</Label>
            {bank ? (
              <NativeSelect value={BANKS.some(([n]) => n === f.bankName) ? f.bankName : ""} onChange={(e) =>
                setF({ ...f, bankName: e.target.value, bankBin: BANKS.find(([n]) => n === e.target.value)?.[1] ?? f.bankBin })}>
                {!BANKS.some(([n]) => n === f.bankName) && <option value="">{f.bankName}</option>}
                {BANKS.map(([n]) => <option key={n}>{n}</option>)}</NativeSelect>
            ) : (
              <><Input list="wallet-names" {...bind("bankName")} /><datalist id="wallet-names">{WALLETS.map((w) => <option key={w} value={w} />)}</datalist></>
            )}</div>
          {bank
            ? <div className="grid gap-1.5"><Label>Mã BIN (NAPAS)</Label><Input {...bind("bankBin")} /></div>
            : <div />}
          <div className="grid gap-1.5"><Label>{bank ? "Số tài khoản" : "Số điện thoại / mã ví"} *</Label><Input {...bind("accountNo")} /></div>
          <div className="grid gap-1.5"><Label>{bank ? "Chủ tài khoản" : "Chủ ví"} *</Label><Input {...bind("accountName")} /></div>
          <div className="col-span-2 grid gap-1.5"><Label>Ghi chú</Label><Input {...bind("note")} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Bỏ qua</Button>
          <Button disabled={!f.bankName.trim() || !f.accountNo.trim() || !f.accountName.trim() || save.isPending} onClick={() => save.mutate()}>Lưu</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
