"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { SettingRow, SettingsCard, SettingsPage } from "@/features/settings/settings-layout-parts";
import { SettingSwitch } from "@/features/settings/setting-switch";
import { CheckLine, DurationBox, Hint, SaveBar, UnitBox } from "@/features/hr/hr-settings-controls";
import { ShiftFormDialog } from "@/features/hr/shift-form-dialog";
import { useHrSettings, useSaveHrSetting, useShifts } from "@/features/hr/hr-queries";
import type { TimekeepingSettings } from "@/features/hr/hr-types";

/** Thiết lập chấm công (ảnh KiotViet 117–118). */
export default function TimekeepingSettingsPage() {
  const { data } = useHrSettings();
  const { data: shifts = [] } = useShifts();
  const [form, setForm] = useState<TimekeepingSettings | null>(null);
  const [shiftsOpen, setShiftsOpen] = useState(false);
  const save = useSaveHrSetting("timekeeping");
  const v = form ?? data?.timekeeping;
  if (!v) return <p className="p-6 text-[13px] text-muted-foreground">Đang tải...</p>;
  const set = <K extends keyof TimekeepingSettings>(k: K, val: TimekeepingSettings[K]) => setForm({ ...v, [k]: val });
  const conv = !v.convertEnabled;

  return (
    <SettingsPage toc={[{ id: "che-do-cham-cong", label: "Chế độ chấm công" }]}>
      <SettingsCard id="che-do-cham-cong" title="Thiết lập chấm công">
        <SettingRow title="Thiết lập ca làm việc" description="Quản lý các ca làm việc của cửa hàng"
          control={<button type="button" onClick={() => setShiftsOpen(true)} className="flex items-center gap-1 text-[13px] font-medium hover:text-primary">
            {shifts.filter((s) => s.active).length} ca làm việc <ChevronRight className="size-4" /></button>} />
        <SettingRow title="Thiết lập số giờ tính công" description="Thiết lập các mức giờ làm tương ứng với số công của loại lương Theo ngày công chuẩn.">
          <div className="mt-3 space-y-3 pl-4 text-[12px]">
            <div className="flex items-center gap-2">Số giờ của 1 ngày công chuẩn là
              <UnitBox label="Số giờ công chuẩn" value={v.standardHours} unit="giờ" step={0.5} onChange={(n) => set("standardHours", n)} />
              <Hint text="Dùng để quy đổi giờ làm thành ngày công và tính đơn giá làm thêm giờ" />
            </div>
            <CheckLine checked={v.convertEnabled} onChange={(b) => set("convertEnabled", b)} label="Quy đổi số giờ làm thành số ngày công"
              hint="Bật: số giờ làm trong ngày được quy về nửa công / 1 công theo mốc bên dưới; tắt: tính theo tỷ lệ giờ làm / giờ công chuẩn" />
            <div className="grid grid-cols-[24px_auto_auto_auto_1fr] items-center gap-x-2 gap-y-2.5 pl-4">
              <span>Từ</span><DurationBox label="Mốc nửa công" minutes={v.halfFrom} disabled={conv} onChange={(m) => set("halfFrom", m)} />
              <span>đến dưới</span><DurationBox label="Mốc 1 công" minutes={v.fullFrom} disabled={conv} onChange={(m) => set("fullFrom", m)} />
              <span className="pl-4">ghi nhận nửa công</span>
              <span>Từ</span><DurationBox label="Mốc 1 công (từ)" minutes={v.fullFrom} disabled={conv} onChange={(m) => set("fullFrom", m)} />
              <span>trở lên</span><span /><span className="pl-4">ghi nhận 1 công</span>
            </div>
            {v.convertEnabled && v.fullFrom <= v.halfFrom && <p className="pl-4 text-destructive">Mốc 1 công phải lớn hơn mốc nửa công</p>}
            <div className="pl-4">
              <CheckLine checked={v.lateEarlyForHalf} disabled={conv} onChange={(b) => set("lateEarlyForHalf", b)}
                label="Ghi nhận đi muộn - về sớm nếu nhân viên làm nửa công" />
            </div>
          </div>
        </SettingRow>
        <SettingRow title="Cài đặt đi muộn - về sớm" description="Cài đặt thời gian tối đa được đi muộn hoặc về sớm">
          <div className="mt-3 space-y-2.5 pl-4">
            <CheckLine checked={v.lateEnabled} onChange={(b) => set("lateEnabled", b)} label="Tính đi muộn sau"
              hint="Vào ca muộn hơn số phút này mới tính là đi muộn">
              <UnitBox label="Số phút đi muộn" value={v.lateAfter} unit="phút" disabled={!v.lateEnabled} onChange={(n) => set("lateAfter", n)} />
            </CheckLine>
            <CheckLine checked={v.earlyEnabled} onChange={(b) => set("earlyEnabled", b)} label="Tính về sớm trước"
              hint="Ra ca sớm hơn số phút này mới tính là về sớm">
              <UnitBox label="Số phút về sớm" value={v.earlyBefore} unit="phút" disabled={!v.earlyEnabled} onChange={(n) => set("earlyBefore", n)} />
            </CheckLine>
          </div>
        </SettingRow>
        <SettingRow title="Cài đặt làm thêm giờ" description="Tính làm thêm giờ cho nhân viên khi vào ca sớm hoặc tan ca muộn">
          <div className="mt-3 space-y-2.5 pl-4">
            <CheckLine checked={v.otBeforeEnabled} onChange={(b) => set("otBeforeEnabled", b)} label="Tính làm thêm giờ trước ca"
              hint="Vào ca sớm hơn số phút này mới tính làm thêm">
              <UnitBox label="Phút làm thêm trước ca" value={v.otBefore} unit="phút" disabled={!v.otBeforeEnabled} onChange={(n) => set("otBefore", n)} />
            </CheckLine>
            <CheckLine checked={v.otAfterEnabled} onChange={(b) => set("otAfterEnabled", b)} label="Tính làm thêm giờ sau ca"
              hint="Ra ca muộn hơn số phút này mới tính làm thêm">
              <UnitBox label="Phút làm thêm sau ca" value={v.otAfter} unit="phút" disabled={!v.otAfterEnabled} onChange={(n) => set("otAfter", n)} />
            </CheckLine>
            <div className="pl-4">
              <CheckLine checked={v.otActualAll} onChange={(b) => set("otActualAll", b)} label="Tính toàn bộ thời gian làm thêm thực tế"
                hint="Bật: tính cả phần thời gian trong ngưỡng; tắt: chỉ tính phần vượt ngưỡng" />
            </div>
          </div>
        </SettingRow>
        <SettingRow title="Cho phép chấm 1 lượt Vào - Ra khi làm nhiều ca liên tục"
          description="Ví dụ: Ca 1 (7:00 - 12:00), Ca 2 (13:00 - 18:00). Bạn chỉ cần chấm công Vào ca 1, chấm công Ra ca 2 (bằng mã QR hoặc chấm vân tay), hệ thống sẽ tự động ghi nhận Ra ca 1 lúc 12:00, Vào ca 2 lúc 13:00"
          control={<SettingSwitch aria-label="Chấm 1 lượt nhiều ca" checked={v.singleInOutMultiShift} onCheckedChange={(b) => set("singleInOutMultiShift", b)} />} />
        <SettingRow title="Tự động chấm công" description="Nhân viên không phải chủ động chấm công. Hệ thống sẽ tự động chấm công thay nhân viên"
          control={<SettingSwitch aria-label="Tự động chấm công" checked={v.autoTimekeeping} onCheckedChange={(b) => set("autoTimekeeping", b)} />} />
        <SettingRow title="Chấm công không cần xếp lịch"
          description="Ngoài các ca làm việc đã được xếp lịch, nhân viên được phép chấm công vào ca làm việc chưa được xếp lịch."
          control={<SettingSwitch aria-label="Chấm công không cần xếp lịch" checked={v.allowUnscheduled} onCheckedChange={(b) => set("allowUnscheduled", b)} />} />
      </SettingsCard>
      <SaveBar dirty={!!form} pending={save.isPending} onSave={() => save.mutate(v, { onSuccess: () => setForm(null) })} />
      {shiftsOpen && <ShiftFormDialog onClose={() => setShiftsOpen(false)} />}
    </SettingsPage>
  );
}
