"use client";

import { useState } from "react";
import Link from "next/link";
import { Settings, X } from "lucide-react";
import { useHrOverview } from "./hr-queries";

/** Thẻ nổi "Khởi tạo" góc phải dưới (ảnh KiotViet 111): số bước khởi tạo đã xong + nút tròn "Khởi tạo". */
export function HrStartWidget() {
  const { data } = useHrOverview();
  const [open, setOpen] = useState(true);
  if (!data) return null;
  const done = [data.employees, data.shifts, data.schedules, data.timekeeping, data.salaries, data.payrolls].filter((n) => n > 0).length;
  return (
    <div className="fixed right-3 bottom-20 z-30 flex flex-col items-end gap-3">
      {open && done < 6 && (
        <div className="relative w-[200px] rounded-lg bg-white p-3 text-[12px] shadow-[0_2px_12px_rgba(0,0,0,0.15)]">
          <button type="button" aria-label="Đóng" className="absolute top-2 right-2 text-muted-foreground" onClick={() => setOpen(false)}><X className="size-3.5" /></button>
          <p className="mb-2 text-[13px] font-semibold">Khởi tạo</p>
          <p>Bạn đã hoàn thành {done}/6 bước khởi tạo.</p>
          <Link href="/employees/settings/start" className="mt-1 inline-block text-primary hover:underline">Tiếp tục tại đây</Link>
        </div>
      )}
      <Link href="/employees/settings/start" className="flex h-[22px] items-center gap-1 rounded-full bg-primary px-2.5 text-[11px] font-semibold text-white">
        <Settings className="size-3.5" /> Khởi tạo
      </Link>
    </div>
  );
}
