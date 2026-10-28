"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { SettingRow, SettingsCard, SettingsPage } from "@/features/settings/settings-layout-parts";
import { SettingSwitch } from "@/features/settings/setting-switch";
import { Hint, SaveBar, UnitBox } from "@/features/hr/hr-settings-controls";
import { HrSettingsNameListDialog } from "@/features/hr/hr-settings-name-list-dialog";
import { useHrSettings, useSaveHrSetting } from "@/features/hr/hr-queries";
import type { PayrollSettings } from "@/features/hr/hr-types";
import { SalaryTemplateDialog } from "@/features/hr/salary-template-dialog";

const outlineBtn = "h-[30px] rounded-md border border-primary px-2.5 text-[12px] font-semibold text-primary hover:bg-primary/5";

function Radio({ checked, onSelect, label, hint }: { checked: boolean; onSelect: () => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[12px]">
      <input type="radio" className="size-3.5 accent-primary" checked={checked} onChange={onSelect} /> {label}
      {hint && <Hint text={hint} />}
    </label>
  );
}

/** Thiết lập tính lương (ảnh KiotViet 119–120) + Thiết lập hoa hồng và thưởng. */
export default function PayrollSettingsPage() {
  const { data } = useHrSettings();
  const [form, setForm] = useState<PayrollSettings | null>(null);
  const [dialog, setDialog] = useState<"templates" | "allowances" | "deductions" | null>(null);
  const save = useSaveHrSetting("payroll");
  const v = form ?? data?.payroll;
  if (!v || !data) return <p className="p-6 text-[13px] text-muted-foreground">Đang tải...</p>;
  const set = <K extends keyof PayrollSettings>(k: K, val: PayrollSettings[K]) => setForm({ ...v, [k]: val });

  return (
    <SettingsPage toc={[{ id: "thiet-lap-tinh-luong", label: "Thiết lập tính lương" }, { id: "hoa-hong-thuong", label: "Thiết lập hoa hồng và thưởng" }]}>
      <SettingsCard id="thiet-lap-tinh-luong" title="Thiết lập tính lương">
        <SettingRow title="Ngày tính lương" description="Ngày bắt đầu tính công cho nhân viên có kỳ lương hàng tháng">
          <div className="mt-2.5 flex items-center gap-2 pl-4 text-[12px]">Chọn ngày bắt đầu kỳ lương hàng tháng
            <select aria-label="Ngày bắt đầu kỳ lương" className="h-[26px] w-[74px] rounded-md border border-[#d9dbe0] bg-white px-1.5"
              value={v.startDay} onChange={(e) => set("startDay", Number(e.target.value))}>
              {Array.from({ length: 28 }, (_, i) => <option key={i + 1} value={i + 1}>Ngày {i + 1}</option>)}
            </select>
            <Hint text="VD ngày 5: kỳ lương tháng 10 tính từ 05/10 đến 04/11" />
          </div>
        </SettingRow>
        <SettingRow title="Cách tính lương theo giờ làm việc" description="Áp dụng cho nhân viên thiết lập lương theo loại lương giờ làm việc">
          <div className="mt-2.5 space-y-2 pl-4">
            <Radio checked={v.hourMode === "ACTUAL"} onSelect={() => set("hourMode", "ACTUAL")} label="Tính lương theo giờ thực tế"
              hint="Tính từ giờ vào đến giờ ra thực tế (trừ phần đã tính làm thêm)" />
            <Radio checked={v.hourMode === "SHIFT"} onSelect={() => set("hourMode", "SHIFT")} label="Tính lương theo giờ trong ca"
              hint="Chỉ tính phần thời gian nằm trong giờ của ca làm việc" />
          </div>
        </SettingRow>
        <SettingRow title="Tự động tạo bảng tính lương" description="Bảng tính lương sẽ được tự động tạo mới vào mỗi kỳ lương"
          control={<SettingSwitch aria-label="Tự động tạo bảng tính lương" checked={v.autoCreate} onCheckedChange={(b) => set("autoCreate", b)} />} />
        <SettingRow title="Tự động cập nhật bảng tính lương" description="Bảng tính lương sẽ được tự động cập nhật mỗi ngày"
          control={<SettingSwitch aria-label="Tự động cập nhật bảng tính lương" checked={v.autoUpdate} onCheckedChange={(b) => set("autoUpdate", b)} />} />
        <SettingRow title="Thiết lập Mẫu lương" description="Thưởng, Hoa hồng, Phụ cấp, Giảm trừ"
          control={<button type="button" onClick={() => setDialog("templates")} className="flex items-center gap-1 text-[13px] font-medium hover:text-primary">
            {data.templates.length} mẫu lương <ChevronRight className="size-4" /></button>} />
        <SettingRow title="Danh mục phụ cấp" description={v.allowances.length ? v.allowances.join(", ")
          : "Danh sách phụ cấp khoản tiền hỗ trợ nhân viên như ăn trưa, đi lại, điện thoại,..."}
          control={<button type="button" className={outlineBtn} onClick={() => setDialog("allowances")}>Thêm phụ cấp</button>} />
        <SettingRow title="Danh mục giảm trừ" description={v.deductions.length ? v.deductions.join(", ")
          : "Thiết lập khoản giảm trừ như đi muộn, về sớm, vi phạm nội quy,..."}
          control={<button type="button" className={outlineBtn} onClick={() => setDialog("deductions")}>Thêm giảm trừ</button>} />
        <SettingRow title="Thuế TNCN cho nhân viên" description="Thiết lập quy định tính thuế TNCN cho nhân viên"
          control={<SettingSwitch aria-label="Thuế TNCN" checked={v.taxEnabled} onCheckedChange={(b) => set("taxEnabled", b)} />}>
          {v.taxEnabled && (
            <div className="mt-2.5 flex flex-wrap items-center gap-4 pl-4 text-[12px]">
              <span className="flex items-center gap-2">Thuế suất <UnitBox label="Thuế suất" value={v.taxRate} unit="%" step={0.5} onChange={(n) => set("taxRate", n)} /></span>
              <span className="flex items-center gap-2">Giảm trừ gia cảnh
                <UnitBox label="Giảm trừ gia cảnh" value={v.taxDeduction} unit="VNĐ" width={90} step={100000} onChange={(n) => set("taxDeduction", n)} />
                <Hint text="Thuế = (Tổng thu nhập − BHXH − giảm trừ gia cảnh) × thuế suất" /></span>
            </div>
          )}
        </SettingRow>
        <SettingRow title="Bảo hiểm xã hội nhân viên" description="Thiết lập quy định đóng bảo hiểm xã hội"
          control={<SettingSwitch aria-label="Bảo hiểm xã hội" checked={v.insuranceEnabled} onCheckedChange={(b) => set("insuranceEnabled", b)} />}>
          {v.insuranceEnabled && (
            <div className="mt-2.5 flex items-center gap-2 pl-4 text-[12px]">Tỷ lệ nhân viên đóng
              <UnitBox label="Tỷ lệ BHXH" value={v.insuranceRate} unit="%" step={0.5} onChange={(n) => set("insuranceRate", n)} />
              <Hint text="Tính trên mức lương thỏa thuận (lương cố định / ngày công chuẩn) hoặc lương chính thực nhận" />
            </div>
          )}
        </SettingRow>
      </SettingsCard>
      <SettingsCard id="hoa-hong-thuong" title="Thiết lập hoa hồng và thưởng">
        <div className="space-y-2.5 px-5 py-3.5">
          <p className="text-[12px] font-medium">Cách ghi nhận doanh thu để tính hoa hồng và thưởng</p>
          <div className="space-y-2 pl-4">
            <Radio checked={v.commissionBase === "NET"} onSelect={() => set("commissionBase", "NET")} label="Doanh thu sau giảm" />
            <Radio checked={v.commissionBase === "PAID"} onSelect={() => set("commissionBase", "PAID")} label="Thực thu" />
          </div>
        </div>
      </SettingsCard>
      <SaveBar dirty={!!form} pending={save.isPending} onSave={() => save.mutate(v, { onSuccess: () => setForm(null) })} />
      {dialog === "templates" && <SalaryTemplateDialog templates={data.templates} lists={v} onClose={() => setDialog(null)} />}
      {(dialog === "allowances" || dialog === "deductions") && (
        <HrSettingsNameListDialog title={dialog === "allowances" ? "Danh mục phụ cấp" : "Danh mục giảm trừ"}
          placeholder={dialog === "allowances" ? "VD: Ăn trưa, Xăng xe" : "VD: Đi muộn, Vi phạm nội quy"}
          names={dialog === "allowances" ? v.allowances : v.deductions}
          onDone={(names) => set(dialog, names)} onClose={() => setDialog(null)} />
      )}
    </SettingsPage>
  );
}
