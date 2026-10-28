"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { useHrOverview } from "@/features/hr/hr-queries";
import { ShiftFormDialog } from "@/features/hr/shift-form-dialog";
import { cn } from "@/lib/utils";

const btn = "h-[26px] min-w-[58px] rounded-md border px-2.5 text-[12px] font-semibold";

/** Thiết lập nhân viên → Khởi tạo (ảnh KiotViet 116): 6 bước, tiến độ N/6 tính từ dữ liệu thật. */
export default function HrStartPage() {
  const router = useRouter();
  const { data: o } = useHrOverview();
  const [creatingShift, setCreatingShift] = useState(false);
  const steps = [
    { done: !!o?.employees, title: "Thêm nhân viên", desc: <>Cửa hàng đang có {o?.employees ?? 0} nhân viên.{" "}
      <Link href="/employees" className="text-primary hover:underline">Xem danh sách</Link></>,
      action: "Thêm nhân viên", onClick: () => router.push("/employees?create=1") },
    { done: !!o?.shifts, title: "Tạo ca làm việc", desc: "Tạo các ca làm việc trong cửa hàng (ví dụ: Ca sáng 8:00 - 12:00).",
      action: "Tạo ca", onClick: () => setCreatingShift(true) },
    { done: !!o?.schedules, title: "Xếp lịch làm việc", desc: "Xếp lịch làm việc cho nhân viên, tự động tạo lịch và hỗ trợ lặp tuần.",
      action: "Xếp lịch", onClick: () => router.push("/employees/schedules"), disabled: !o?.shifts },
    { done: !!o?.timekeeping, title: "Hình thức chấm công", desc: "Chọn hình thức chấm công của cửa hàng (Chấm công điện thoại, Máy chấm công).",
      action: "Thiết lập", onClick: () => router.push("/employees/settings/mobile") },
    { done: !!o?.salaries, title: "Thiết lập lương", desc: "Cấu hình các mục được ghi nhận lương, thưởng, hoa hồng, phụ cấp.",
      action: "Thiết lập", onClick: () => router.push("/employees/settings/payroll") },
    { done: !!o?.payrolls, title: "Thiết lập bảng lương", desc: <>Theo dõi chính xác và tự động tính lương của nhân viên.{" "}
      <Link href="/employees/payrolls" className="text-primary hover:underline">Xem danh sách</Link></>,
      action: "Tạo bảng lương", onClick: () => router.push("/employees/payrolls") },
  ];
  const done = steps.filter((s) => s.done).length;

  return (
    <section className="rounded-lg bg-background">
      <div className="flex items-start gap-4 px-4 pt-3 pb-2">
        <div className="flex-1">
          <h2 className="text-[13px] font-semibold">Khởi tạo</h2>
          <p className="text-[12px] text-muted-foreground">Chỉ vài bước cài đặt để quản lý nhân viên hiệu quả, tối ưu vận hành và tính lương chính xác</p>
        </div>
        <div className="flex items-center gap-2 pt-1 text-[12px] text-muted-foreground">
          <div className="h-2 w-16 overflow-hidden rounded-full bg-[#e5e7eb]" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={6}>
            <div className="h-full rounded-full bg-primary" style={{ width: `${(done / 6) * 100}%` }} />
          </div>
          {done}/6
        </div>
      </div>
      {steps.map((s, i) => (
        <div key={s.title} className={cn("flex items-center gap-3 border-t border-[#eceef1] px-4 py-2.5", i === 0 && "border-t-0")}>
          {s.done
            ? <span className="flex size-[18px] shrink-0 items-center justify-center rounded-full border border-foreground"><Check className="size-3" strokeWidth={3} /></span>
            : <span className={cn("flex size-[15px] shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
              s.disabled ? "border border-[#c9ced6] text-[#c9ced6]" : "bg-primary text-white")}>{i + 1}</span>}
          <div className={cn("min-w-0 flex-1", s.done && "pl-1.5", s.disabled && "opacity-40")}>
            <p className="text-[12px] font-semibold">{s.title}</p>
            <p className="text-[11px] text-muted-foreground">{s.desc}</p>
          </div>
          <button type="button" onClick={s.onClick} disabled={s.disabled}
            className={cn(btn, s.done ? "border-foreground text-foreground hover:bg-muted" : "border-primary text-primary hover:bg-primary/5",
              "disabled:border-[#c9ced6] disabled:text-[#c9ced6] disabled:hover:bg-transparent")}>{s.action}</button>
        </div>
      ))}
      {creatingShift && <ShiftFormDialog onClose={() => setCreatingShift(false)} />}
    </section>
  );
}
