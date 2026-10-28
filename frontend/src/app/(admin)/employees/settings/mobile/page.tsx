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

/**
 * Chấm công trên điện thoại (thay cho "Zalo mini app" trả phí của KiotViet): nhân viên đăng nhập trên điện thoại,
 * quét mã QR đổi mỗi phút đang hiển thị tại quầy chi nhánh rồi bấm Vào ca / Ra ca.
 */
export default function MobileClockSettingsPage() {
  const { data } = useHrSettings();
  const { data: branches = [] } = useBranches();
  const save = useSaveHrSetting("mobile");
  const [branchId, setBranchId] = useState("");
  const [showing, setShowing] = useState(false);
  const mobile = data?.mobile;
  const step = (n: number, text: React.ReactNode) => (
    <p className="flex items-start gap-2"><span className="shrink-0 rounded bg-[#eff0f3] px-1.5 py-0.5 text-[12px] font-medium">Bước {n}</span><span>{text}</span></p>
  );
  return (
    <SettingsPage toc={[{ id: "mobile", label: "Chấm công điện thoại" }, { id: "qr", label: "Mã QR chi nhánh" }]}>
      <SettingsCard id="mobile" title="Chấm công trên điện thoại" description="Nhân viên tự chấm công Vào ca / Ra ca bằng điện thoại cá nhân, không cần máy chấm công">
        <SettingRow title="Cho phép chấm công trên điện thoại" description="Nhân viên đăng nhập bằng tài khoản đã liên kết hồ sơ nhân viên"
          control={<SettingSwitch checked={mobile?.enabled ?? false} disabled={!mobile}
            onCheckedChange={(v) => mobile && save.mutate({ ...mobile, enabled: v })} />} />
        <SettingRow title="Bắt buộc quét mã QR tại chi nhánh"
          description="Chống chấm công hộ từ xa: mã QR đổi mỗi phút và chỉ hiển thị trên màn hình tại quầy. Tắt để cho phép chấm công không cần quét mã."
          control={<SettingSwitch checked={mobile?.requireQr ?? true} disabled={!mobile}
            onCheckedChange={(v) => mobile && save.mutate({ ...mobile, requireQr: v })} />} />
        <div className="space-y-2 px-5 py-3.5 text-[13px]">
          {step(1, <>Vào <Link href="/employees" className="text-primary hover:underline">Danh sách nhân viên</Link>, liên kết tài khoản đăng nhập cho từng nhân viên.</>)}
          {step(2, "Mở mã QR chi nhánh bên dưới trên máy tính / máy tính bảng đặt tại quầy.")}
          {step(3, <>Nhân viên quét mã bằng camera điện thoại (hoặc mở <b>/cham-cong</b>), đăng nhập và bấm Vào ca / Ra ca.</>)}
        </div>
      </SettingsCard>
      <SettingsCard id="qr" title="Mã QR chi nhánh" description="Hiển thị toàn màn hình, tự đổi mã mỗi 60 giây">
        <div className="flex items-center gap-3 px-5 py-4">
          <select aria-label="Chi nhánh" className="h-[30px] w-64 rounded-md border border-[#d9dbe0] bg-white px-2 text-[13px]"
            value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">Chọn chi nhánh</option>
            {branches.filter((b) => b.active).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <Button disabled={!branchId} onClick={() => setShowing(true)}><QrCode className="size-4" /> Hiện mã QR chi nhánh</Button>
        </div>
      </SettingsCard>
      {showing && branchId && <BranchClockQrDisplay branchId={branchId} onClose={() => setShowing(false)} />}
    </SettingsPage>
  );
}
