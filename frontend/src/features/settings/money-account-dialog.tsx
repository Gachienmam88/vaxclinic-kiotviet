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
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { settingsNs } from "@/messages/settings";

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
  const t = useT(settingsNs);
  const tc = useT(commonNs);
  const bank = kind === "BANK";
  const [f, setF] = useState({
    bankName: account?.bankName ?? (bank ? "VietinBank" : "MoMo"), bankBin: account?.bankBin ?? (bank ? "970415" : ""),
    accountNo: account?.accountNo ?? "", accountName: account?.accountName ?? "", note: account?.note ?? "",
  });
  const save = useMutation({
    mutationFn: () => api(account ? `/bank-accounts/${account.id}` : "/bank-accounts", { method: account ? "PUT" : "POST", body: { ...f, kind } }),
    onSuccess: () => { toast.success(account ? t("moneyAccount.updated") : t("moneyAccount.added")); qc.invalidateQueries({ queryKey: ["bank-accounts"] }); onClose(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const bind = (k: keyof typeof f) => ({ value: f[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value }) });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{t(bank ? (account ? "moneyAccount.editBank" : "moneyAccount.addBank") : (account ? "moneyAccount.editWallet" : "moneyAccount.addWallet"))}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="grid gap-1.5"><Label>{bank ? t("moneyAccount.bank") : t("moneyAccount.wallet")}</Label>
            {bank ? (
              <NativeSelect value={BANKS.some(([n]) => n === f.bankName) ? f.bankName : ""} onChange={(e) =>
                setF({ ...f, bankName: e.target.value, bankBin: BANKS.find(([n]) => n === e.target.value)?.[1] ?? f.bankBin })}>
                {!BANKS.some(([n]) => n === f.bankName) && <option value="">{f.bankName}</option>}
                {BANKS.map(([n]) => <option key={n}>{n}</option>)}</NativeSelect>
            ) : (
              <><Input list="wallet-names" {...bind("bankName")} /><datalist id="wallet-names">{WALLETS.map((w) => <option key={w} value={w} />)}</datalist></>
            )}</div>
          {bank
            ? <div className="grid gap-1.5"><Label>{t("moneyAccount.bin")}</Label><Input {...bind("bankBin")} /></div>
            : <div />}
          <div className="grid gap-1.5"><Label>{bank ? t("moneyAccount.accountNo") : t("moneyAccount.walletNo")} *</Label><Input {...bind("accountNo")} /></div>
          <div className="grid gap-1.5"><Label>{bank ? t("moneyAccount.holder") : t("moneyAccount.walletHolder")} *</Label><Input {...bind("accountName")} /></div>
          <div className="col-span-2 grid gap-1.5"><Label>{t("moneyAccount.note")}</Label><Input {...bind("note")} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{tc("actions.skip")}</Button>
          <Button disabled={!f.bankName.trim() || !f.accountNo.trim() || !f.accountName.trim() || save.isPending} onClick={() => save.mutate()}>{tc("actions.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
