"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, QrCode, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ListEmptyRow } from "@/components/ui/list-empty-state";
import { MoneyAccountDialog } from "@/features/settings/money-account-dialog";
import { SettingsCard, SettingsPage } from "@/features/settings/settings-shell";
import { QrPaymentDialog } from "@/features/sales/qr-payment-dialog";
import type { BankAccount } from "@/features/sales/sales-types";
import { api, errorMessage } from "@/lib/api-client";
import { useCurrentUser } from "@/lib/use-current-user";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { settingsNs } from "@/messages/settings";

/** Bảng tài khoản thu chi của 1 tab (ngân hàng hoặc ví điện tử). */
function AccountTable({ kind, list, onEdit }: { kind: "BANK" | "EWALLET"; list: BankAccount[]; onEdit: (a: BankAccount) => void }) {
  const qc = useQueryClient();
  const { can } = useCurrentUser();
  const t = useT(settingsNs);
  const tc = useT(commonNs);
  const remove = useMutation({
    mutationFn: (id: string) => api(`/bank-accounts/${id}/deactivate`, { method: "POST" }),
    onSuccess: () => { toast.success(t("bankAccounts.deleted")); qc.invalidateQueries({ queryKey: ["bank-accounts"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const bank = kind === "BANK";
  return (
    <table className="w-full text-[13px]">
      <thead className="bg-[#f0f2f5] text-left text-xs [&_th]:h-[34px] [&_th]:font-semibold"><tr><th className="px-3 py-2">{bank ? t("bankAccounts.colAccountNo") : t("bankAccounts.colWalletNo")}</th>
        <th className="px-3">{bank ? t("bankAccounts.colBank") : t("bankAccounts.colWallet")}</th><th className="px-3">{bank ? t("bankAccounts.colHolder") : t("bankAccounts.colWalletHolder")}</th>
        <th className="px-3">{t("bankAccounts.colScope")}</th><th className="px-3">{t("bankAccounts.colNote")}</th><th className="w-24 px-3 text-right">{t("common.actions")}</th></tr></thead>
      <tbody>
        {!list.length && <ListEmptyRow cols={6} what={bank ? t("bankAccounts.emptyBank") : t("bankAccounts.emptyWallet")} compact />}
        {list.map((a) => (
          <tr key={a.id} className="border-b">
            <td className="px-3 py-2">{a.accountNo}{bank && !a.bankBin && <span className="block text-xs text-destructive">{t("bankAccounts.missingBin")}</span>}</td>
            <td className="px-3">{a.bankName}</td><td className="px-3">{a.accountName}</td><td className="px-3">{t("bankAccounts.scopeAll")}</td>
            <td className="px-3 text-muted-foreground">{a.note}</td>
            <td className="px-3 text-right">{can("cashbook.manage") && <>
              <Button size="icon-sm" variant="ghost" title={tc("actions.edit")} onClick={() => onEdit(a)}><Pencil className="size-4" /></Button>
              <Button size="icon-sm" variant="ghost" title={tc("actions.delete")} className="text-destructive"
                onClick={() => confirm(t("bankAccounts.confirmDelete", { accountNo: a.accountNo })) && remove.mutate(a.id)}><Trash2 className="size-4" /></Button>
            </>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Thiết lập → Sổ quỹ: quản lý tài khoản ngân hàng (VietQR) và ví điện tử dùng cho thu chi. */
export default function MoneyAccountsPage() {
  const { can } = useCurrentUser();
  const t = useT(settingsNs);
  const { data: all = [] } = useQuery({ queryKey: ["bank-accounts", "ALL"], queryFn: () => api<BankAccount[]>("/bank-accounts?kind=ALL") });
  const [tab, setTab] = useState<"BANK" | "EWALLET">("BANK");
  const [dialog, setDialog] = useState<{ account?: BankAccount } | null>(null);
  const [preview, setPreview] = useState(false);
  const banks = all.filter((a) => (a.kind ?? "BANK") === "BANK"), wallets = all.filter((a) => a.kind === "EWALLET");

  return (
    <SettingsPage toc={[{ id: "accounts", label: t("bankAccounts.title") }]}>
      <SettingsCard id="accounts" title={t("bankAccounts.title")} description={t("bankAccounts.description")}>
        <div className="p-4">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "BANK" | "EWALLET")}>
            <div className="flex items-center">
              <TabsList variant="line">
                <TabsTrigger value="BANK">{t("bankAccounts.tabBank")} <span className="ml-1 text-xs text-muted-foreground">{banks.length}</span></TabsTrigger>
                <TabsTrigger value="EWALLET">{t("bankAccounts.tabWallet")} <span className="ml-1 text-xs text-muted-foreground">{wallets.length}</span></TabsTrigger>
              </TabsList>
              <div className="ml-auto flex gap-2">
                {tab === "BANK" && banks.length > 0 && <Button variant="outline" size="sm" onClick={() => setPreview(true)}><QrCode className="size-4" /> {t("bankAccounts.tryQr")}</Button>}
                {can("cashbook.manage") && <Button variant="outline" size="sm" onClick={() => setDialog({})}><Plus className="size-4" /> {t("bankAccounts.add")}</Button>}
              </div>
            </div>
            <TabsContent value="BANK" className="pt-3"><AccountTable kind="BANK" list={banks} onEdit={(account) => setDialog({ account })} /></TabsContent>
            <TabsContent value="EWALLET" className="pt-3"><AccountTable kind="EWALLET" list={wallets} onEdit={(account) => setDialog({ account })} /></TabsContent>
          </Tabs>
        </div>
      </SettingsCard>
      {dialog && <MoneyAccountDialog key={dialog.account?.id ?? tab} kind={dialog.account?.kind ?? tab} account={dialog.account} onClose={() => setDialog(null)} />}
      {preview && <QrPaymentDialog amount={10000} info="Thu thu QR" onClose={() => setPreview(false)} />}
    </SettingsPage>
  );
}
