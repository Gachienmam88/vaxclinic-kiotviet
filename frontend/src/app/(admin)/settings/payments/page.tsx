"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SettingSwitch } from "@/features/settings/setting-switch";
import { SettingRow, SettingsCard, SettingsPage } from "@/features/settings/settings-shell";
import { api, errorMessage } from "@/lib/api-client";
import { formatMoney } from "@/lib/format";
import { useCurrentUser } from "@/lib/use-current-user";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { settingsNs } from "@/messages/settings";

type SePay = { enabled: boolean; configured: boolean; autoComplete: boolean };
type Tx = { sepay_id: number; gateway: string; transaction_date: string; account_number: string; transfer_type: string;
  amount: number; content: string; payment_code: string | null };

/** Thiết lập → Thanh toán: báo có tự động qua SePay + danh sách giao dịch ngân hàng nhận được. */
export default function PaymentSettingsPage() {
  const qc = useQueryClient();
  const { can } = useCurrentUser();
  const t = useT(settingsNs);
  const tc = useT(commonNs);
  const { data: s } = useQuery({ queryKey: ["sepay-settings"], queryFn: () => api<SePay>("/payments/sepay/settings") });
  const { data: txs = [] } = useQuery({ queryKey: ["bank-transactions"], queryFn: () => api<Tx[]>("/payments/transactions?limit=50"),
    enabled: can("cashbook.manage"), refetchInterval: 15_000 });
  const [apiKey, setApiKey] = useState("");
  const save = useMutation({
    mutationFn: (body: { enabled: boolean; apiKey?: string; autoComplete: boolean }) => api<SePay>("/payments/sepay/settings", { method: "PUT", body }),
    onSuccess: (d) => { qc.setQueryData(["sepay-settings"], d); setApiKey(""); toast.success(t("common.updated")); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (!s) return <div className="p-6 text-[13px] text-muted-foreground">{tc("status.loading")}</div>;
  const readOnly = !can("settings.manage") || save.isPending;
  const webhook = typeof window === "undefined" ? "" : `${window.location.origin}/api/payments/sepay/webhook`;

  return (
    <SettingsPage toc={[{ id: "sepay", label: t("payments.tocSepay") }, { id: "transactions", label: t("payments.tocTransactions") }]}>
      <SettingsCard id="sepay" title={t("payments.sepayTitle")}
        description={t("payments.sepayDesc")}
        action={<SettingSwitch checked={s.enabled} disabled={readOnly}
          onCheckedChange={(v) => save.mutate({ enabled: v, apiKey: apiKey || undefined, autoComplete: s.autoComplete })} />}>
        <SettingRow title={t("payments.step1")}
          description={t("payments.step1Desc")} />
        <SettingRow title={t("payments.step2")}
          description={t("payments.step2Desc")}>
          <div className="mt-2 flex items-center gap-2">
            <Input readOnly value={webhook} className="font-mono text-xs" />
            <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(webhook).then(() => toast.success(t("payments.copied")))}>
              <Copy className="size-4" /> {tc("actions.copy")}</Button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{t("payments.webhookNote")}</p>
        </SettingRow>
        <SettingRow title={t("payments.step3")}
          description={s.configured ? t("payments.keySaved") : t("payments.noKey")}>
          <div className="mt-2 flex items-center gap-2">
            <Input type="password" autoComplete="new-password" placeholder="API key" value={apiKey} disabled={readOnly}
              onChange={(e) => setApiKey(e.target.value)} />
            <Button disabled={readOnly || !apiKey.trim()} onClick={() => save.mutate({ enabled: s.enabled, apiKey, autoComplete: s.autoComplete })}>{t("payments.saveKey")}</Button>
          </div>
        </SettingRow>
        <SettingRow title={t("payments.autoComplete")}
          description={t("payments.autoCompleteDesc")}
          control={<SettingSwitch checked={s.autoComplete} disabled={readOnly}
            onCheckedChange={(v) => save.mutate({ enabled: s.enabled, autoComplete: v })} />} />
      </SettingsCard>
      {can("cashbook.manage") && (
        <SettingsCard id="transactions" title={t("payments.txTitle")} description={t("payments.txDesc")}>
          <div className="overflow-x-auto p-4">
            <table className="w-full text-[13px]">
              <thead className="bg-[#f0f2f5] text-left text-xs [&_th]:h-[34px] [&_th]:font-semibold"><tr><th className="px-2 py-2">{t("payments.colTime")}</th><th className="px-2">{t("payments.colBank")}</th>
                <th className="px-2">{t("payments.colAccount")}</th><th className="px-2 text-right">{t("payments.colAmount")}</th><th className="px-2">{t("payments.colContent")}</th><th className="px-2">{t("payments.colPaymentCode")}</th></tr></thead>
              <tbody>
                {!txs.length && <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">{t("payments.noTx")}</td></tr>}
                {txs.map((tx) => (
                  <tr key={tx.sepay_id} className="border-b">
                    <td className="px-2 py-2">{tx.transaction_date}</td><td className="px-2">{tx.gateway}</td><td className="px-2">{tx.account_number}</td>
                    <td className={`px-2 text-right font-medium ${tx.transfer_type === "in" ? "text-green-600" : "text-destructive"}`}>
                      {tx.transfer_type === "in" ? "+" : "-"}{formatMoney(tx.amount)}</td>
                    <td className="px-2">{tx.content}</td><td className="px-2">{tx.payment_code ?? <span className="text-muted-foreground">{t("payments.unmatched")}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SettingsCard>
      )}
    </SettingsPage>
  );
}
