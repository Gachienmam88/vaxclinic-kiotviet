"use client";

import { useState } from "react";
import Link from "next/link";
import { QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SettingRow, SettingsCard, SettingsPage } from "@/features/settings/settings-layout-parts";
import { SettingSwitch } from "@/features/settings/setting-switch";
import { useBranches } from "@/features/settings/settings-queries";
import { BranchClockQrDisplay } from "@/features/hr/branch-clock-qr-display";
import { useHrSettings, useSaveHrSetting } from "@/features/hr/hr-queries";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { hrNs } from "@/messages/hr";
import { renderRichText } from "@/lib/i18n/render-rich-text";

/**
 * Chấm công trên điện thoại (thay cho "Zalo mini app" trả phí của KiotViet): nhân viên đăng nhập trên điện thoại,
 * quét mã QR đổi mỗi phút đang hiển thị tại quầy chi nhánh rồi bấm Vào ca / Ra ca.
 */
export default function MobileClockSettingsPage() {
  const t = useT(hrNs);
  const tc = useT(commonNs);
  const { data } = useHrSettings();
  const { data: branches = [] } = useBranches();
  const save = useSaveHrSetting("mobile");
  const [branchId, setBranchId] = useState("");
  const [showing, setShowing] = useState(false);
  const mobile = data?.mobile;
  const step = (n: number, text: React.ReactNode) => (
    <p className="flex items-start gap-2"><span className="shrink-0 rounded bg-[#eff0f3] px-1.5 py-0.5 text-[12px] font-medium">{t("settings.step", { n })}</span><span>{text}</span></p>
  );
  return (
    <SettingsPage toc={[{ id: "mobile", label: t("settingsMenu.mobile") }, { id: "qr", label: t("mobileSettings.qrTitle") }]}>
      <SettingsCard id="mobile" title={t("mobileSettings.title")} description={t("mobileSettings.description")}>
        <SettingRow title={t("mobileSettings.enable")} description={t("mobileSettings.enableHint")}
          control={<SettingSwitch checked={mobile?.enabled ?? false} disabled={!mobile}
            onCheckedChange={(v) => mobile && save.mutate({ ...mobile, enabled: v })} />} />
        <SettingRow title={t("mobileSettings.requireQr")}
          description={t("mobileSettings.requireQrHint")}
          control={<SettingSwitch checked={mobile?.requireQr ?? true} disabled={!mobile}
            onCheckedChange={(v) => mobile && save.mutate({ ...mobile, requireQr: v })} />} />
        <div className="space-y-2 px-5 py-3.5 text-[13px]">
          {step(1, renderRichText(t("mobileSettings.step1"), { link: <Link href="/employees" className="text-primary hover:underline">{t("list.title")}</Link> }))}
          {step(2, t("mobileSettings.step2"))}
          {step(3, renderRichText(t("mobileSettings.step3"), { path: <b>/cham-cong</b> }))}
        </div>
      </SettingsCard>
      <SettingsCard id="qr" title={t("mobileSettings.qrTitle")} description={t("mobileSettings.qrDescription")}>
        <div className="flex items-center gap-3 px-5 py-4">
          <select aria-label={tc("fields.branch")} className="h-[30px] w-64 rounded-md border border-[#d9dbe0] bg-white px-2 text-[13px]"
            value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">{t("advance.pickBranch")}</option>
            {branches.filter((b) => b.active).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <Button disabled={!branchId} onClick={() => setShowing(true)}><QrCode className="size-4" /> {t("mobileSettings.showQr")}</Button>
        </div>
      </SettingsCard>
      {showing && branchId && <BranchClockQrDisplay branchId={branchId} onClose={() => setShowing(false)} />}
    </SettingsPage>
  );
}
