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

type SePay = { enabled: boolean; configured: boolean; autoComplete: boolean };
type Tx = { sepay_id: number; gateway: string; transaction_date: string; account_number: string; transfer_type: string;
  amount: number; content: string; payment_code: string | null };

/** Thiết lập → Thanh toán: báo có tự động qua SePay + danh sách giao dịch ngân hàng nhận được. */
export default function PaymentSettingsPage() {
  const qc = useQueryClient();
  const { can } = useCurrentUser();
  const { data: s } = useQuery({ queryKey: ["sepay-settings"], queryFn: () => api<SePay>("/payments/sepay/settings") });
  const { data: txs = [] } = useQuery({ queryKey: ["bank-transactions"], queryFn: () => api<Tx[]>("/payments/transactions?limit=50"),
    enabled: can("cashbook.manage"), refetchInterval: 15_000 });
  const [apiKey, setApiKey] = useState("");
  const save = useMutation({
    mutationFn: (body: { enabled: boolean; apiKey?: string; autoComplete: boolean }) => api<SePay>("/payments/sepay/settings", { method: "PUT", body }),
    onSuccess: (d) => { qc.setQueryData(["sepay-settings"], d); setApiKey(""); toast.success("Thiết lập đã được cập nhật thành công"); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (!s) return <div className="p-6 text-[13px] text-muted-foreground">Đang tải...</div>;
  const readOnly = !can("settings.manage") || save.isPending;
  const webhook = typeof window === "undefined" ? "" : `${window.location.origin}/api/payments/sepay/webhook`;

  return (
    <SettingsPage toc={[{ id: "sepay", label: "Báo có SePay" }, { id: "transactions", label: "Giao dịch ngân hàng" }]}>
      <SettingsCard id="sepay" title="Thông báo thanh toán QR (SePay)"
        description="Tiền về tài khoản là màn bán hàng báo ngay, tự khớp với hóa đơn — không lo mất tiền oan, hết đối soát thủ công."
        action={<SettingSwitch checked={s.enabled} disabled={readOnly}
          onCheckedChange={(v) => save.mutate({ enabled: v, apiKey: apiKey || undefined, autoComplete: s.autoComplete })} />}>
        <SettingRow title="Bước 1 — Đăng ký SePay và liên kết tài khoản ngân hàng"
          description={<>Tạo tài khoản tại sepay.vn, liên kết các tài khoản ngân hàng nhận tiền (trùng với Thiết lập → Sổ quỹ).</>} />
        <SettingRow title="Bước 2 — Tạo webhook trong SePay"
          description="Chọn kiểu xác thực API Key, sự kiện: Có tiền vào. Dán URL dưới đây vào ô URL nhận webhook.">
          <div className="mt-2 flex items-center gap-2">
            <Input readOnly value={webhook} className="font-mono text-xs" />
            <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(webhook).then(() => toast.success("Đã sao chép"))}>
              <Copy className="size-4" /> Sao chép</Button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">URL phải truy cập được từ Internet (máy chủ có tên miền). Chạy trên máy nội bộ thì SePay không gọi vào được.</p>
        </SettingRow>
        <SettingRow title="Bước 3 — Nhập API key đã đặt trong SePay"
          description={s.configured ? "Đã lưu API key. Nhập key mới nếu muốn đổi." : "Chưa có API key."}>
          <div className="mt-2 flex items-center gap-2">
            <Input type="password" autoComplete="new-password" placeholder="API key" value={apiKey} disabled={readOnly}
              onChange={(e) => setApiKey(e.target.value)} />
            <Button disabled={readOnly || !apiKey.trim()} onClick={() => save.mutate({ enabled: s.enabled, apiKey, autoComplete: s.autoComplete })}>Lưu key</Button>
          </div>
        </SettingRow>
        <SettingRow title="Tự động hoàn thành hóa đơn khi nhận đủ tiền"
          description="Khách quét QR ở màn bán hàng và chuyển khoản đủ tiền → hóa đơn tự hoàn thành, không cần bấm Thanh toán."
          control={<SettingSwitch checked={s.autoComplete} disabled={readOnly}
            onCheckedChange={(v) => save.mutate({ enabled: s.enabled, autoComplete: v })} />} />
      </SettingsCard>
      {can("cashbook.manage") && (
        <SettingsCard id="transactions" title="Giao dịch ngân hàng gần đây" description="Do SePay báo về; cột Mã thanh toán có giá trị là đã khớp với mã QR ở màn bán hàng.">
          <div className="overflow-x-auto p-4">
            <table className="w-full text-[13px]">
              <thead className="bg-[#f0f2f5] text-left text-xs [&_th]:h-[34px] [&_th]:font-semibold"><tr><th className="px-2 py-2">Thời gian</th><th className="px-2">Ngân hàng</th>
                <th className="px-2">Tài khoản</th><th className="px-2 text-right">Số tiền</th><th className="px-2">Nội dung</th><th className="px-2">Mã thanh toán</th></tr></thead>
              <tbody>
                {!txs.length && <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">Chưa có giao dịch</td></tr>}
                {txs.map((t) => (
                  <tr key={t.sepay_id} className="border-b">
                    <td className="px-2 py-2">{t.transaction_date}</td><td className="px-2">{t.gateway}</td><td className="px-2">{t.account_number}</td>
                    <td className={`px-2 text-right font-medium ${t.transfer_type === "in" ? "text-green-600" : "text-destructive"}`}>
                      {t.transfer_type === "in" ? "+" : "-"}{formatMoney(t.amount)}</td>
                    <td className="px-2">{t.content}</td><td className="px-2">{t.payment_code ?? <span className="text-muted-foreground">Chưa khớp</span>}</td>
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
