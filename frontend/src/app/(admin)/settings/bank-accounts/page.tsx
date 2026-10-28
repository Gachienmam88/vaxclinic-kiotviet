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

/** Bảng tài khoản thu chi của 1 tab (ngân hàng hoặc ví điện tử). */
function AccountTable({ kind, list, onEdit }: { kind: "BANK" | "EWALLET"; list: BankAccount[]; onEdit: (a: BankAccount) => void }) {
  const qc = useQueryClient();
  const { can } = useCurrentUser();
  const remove = useMutation({
    mutationFn: (id: string) => api(`/bank-accounts/${id}/deactivate`, { method: "POST" }),
    onSuccess: () => { toast.success("Đã xóa tài khoản"); qc.invalidateQueries({ queryKey: ["bank-accounts"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const bank = kind === "BANK";
  return (
    <table className="w-full text-[13px]">
      <thead className="bg-[#f0f2f5] text-left text-xs [&_th]:h-[34px] [&_th]:font-semibold"><tr><th className="px-3 py-2">{bank ? "Số tài khoản" : "Số điện thoại / mã ví"}</th>
        <th className="px-3">{bank ? "Ngân hàng" : "Ví điện tử"}</th><th className="px-3">{bank ? "Chủ tài khoản" : "Chủ ví"}</th>
        <th className="px-3">Phạm vi áp dụng</th><th className="px-3">Ghi chú</th><th className="w-24 px-3 text-right">Thao tác</th></tr></thead>
      <tbody>
        {!list.length && <ListEmptyRow cols={6} what={bank ? "tài khoản ngân hàng" : "ví điện tử"} compact />}
        {list.map((a) => (
          <tr key={a.id} className="border-b">
            <td className="px-3 py-2">{a.accountNo}{bank && !a.bankBin && <span className="block text-xs text-destructive">thiếu mã BIN — không tạo được QR</span>}</td>
            <td className="px-3">{a.bankName}</td><td className="px-3">{a.accountName}</td><td className="px-3">Toàn hệ thống</td>
            <td className="px-3 text-muted-foreground">{a.note}</td>
            <td className="px-3 text-right">{can("cashbook.manage") && <>
              <Button size="icon-sm" variant="ghost" title="Sửa" onClick={() => onEdit(a)}><Pencil className="size-4" /></Button>
              <Button size="icon-sm" variant="ghost" title="Xóa" className="text-destructive"
                onClick={() => confirm(`Xóa tài khoản ${a.accountNo}? Các phiếu thu chi cũ không bị ảnh hưởng.`) && remove.mutate(a.id)}><Trash2 className="size-4" /></Button>
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
  const { data: all = [] } = useQuery({ queryKey: ["bank-accounts", "ALL"], queryFn: () => api<BankAccount[]>("/bank-accounts?kind=ALL") });
  const [tab, setTab] = useState<"BANK" | "EWALLET">("BANK");
  const [dialog, setDialog] = useState<{ account?: BankAccount } | null>(null);
  const [preview, setPreview] = useState(false);
  const banks = all.filter((a) => (a.kind ?? "BANK") === "BANK"), wallets = all.filter((a) => a.kind === "EWALLET");

  return (
    <SettingsPage toc={[{ id: "accounts", label: "Quản lý tài khoản thu chi" }]}>
      <SettingsCard id="accounts" title="Quản lý tài khoản thu chi" description="Quản lý các tài khoản ngân hàng và ví điện tử dùng cho giao dịch thu chi của cửa hàng.">
        <div className="p-4">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "BANK" | "EWALLET")}>
            <div className="flex items-center">
              <TabsList variant="line">
                <TabsTrigger value="BANK">Tài khoản ngân hàng <span className="ml-1 text-xs text-muted-foreground">{banks.length}</span></TabsTrigger>
                <TabsTrigger value="EWALLET">Ví điện tử <span className="ml-1 text-xs text-muted-foreground">{wallets.length}</span></TabsTrigger>
              </TabsList>
              <div className="ml-auto flex gap-2">
                {tab === "BANK" && banks.length > 0 && <Button variant="outline" size="sm" onClick={() => setPreview(true)}><QrCode className="size-4" /> Thử tạo QR</Button>}
                {can("cashbook.manage") && <Button variant="outline" size="sm" onClick={() => setDialog({})}><Plus className="size-4" /> Thêm tài khoản</Button>}
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
