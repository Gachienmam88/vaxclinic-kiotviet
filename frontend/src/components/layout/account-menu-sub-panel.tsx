"use client";

import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";

/**
 * Bảng con trong menu tài khoản (VD "‹ Chủ đề" ảnh 190): khi đang hiện, AccountMenuDropdown ẩn các mục khác
 * (nhờ data-account-subpanel) nên bảng con thay chỗ cả menu; bấm "‹" để quay lại.
 * Dùng chung cho các mục chèn qua extraItems (Chủ đề, Ngôn ngữ…). Số đo từ ảnh KiotViet quy về px gốc (× 1.5 / 1.12).
 */
export function AccountMenuSubPanel({ title, onBack, children }: { title: string; onBack: () => void; children: ReactNode }) {
  return (
    <div data-account-subpanel className="pb-5">
      <button type="button" onClick={onBack}
        className="flex h-[42px] w-full items-center gap-1 px-2.5 text-left text-[13px] font-semibold hover:text-primary">
        <ChevronLeft className="size-4 text-muted-foreground" /> {title}
      </button>
      <div className="pt-2.5">{children}</div>
    </div>
  );
}
