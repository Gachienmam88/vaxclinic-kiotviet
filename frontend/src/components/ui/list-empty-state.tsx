"use client";

import { Inbox } from "lucide-react";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";

/**
 * Trạng thái rỗng của mọi danh sách, theo KiotViet: vòng tròn xanh nhạt + hộp thư, "Không tìm thấy kết quả",
 * dòng mô tả; onWiden (nếu có) → "Nhấn vào đây để tiếp tục tìm kiếm" (mở rộng ra toàn thời gian).
 * what: danh từ trong câu mô tả ("giao dịch", "hàng hóa", "nhà cung cấp"...) — nơi gọi truyền chuỗi đã dịch;
 * period: "trong tháng này"... (đã dịch). Câu ghép theo common.emptyState.* để đúng trật tự từ từng ngôn ngữ.
 * compact: bảng con trong panel chi tiết — khung thấp hơn, không kèm "với điều kiện lọc".
 */
export function ListEmptyState({ what, period, onWiden, compact }: {
  what?: string; period?: string; onWiden?: () => void; compact?: boolean;
}) {
  const tc = useT(commonNs);
  const noun = what ?? tc("emptyState.defaultWhat");
  const suffix = period ?? (onWiden ? tc("emptyState.suffixThisMonth") : compact ? "" : tc("emptyState.suffixFilter"));
  return (
    <div className={compact ? "py-8 text-center" : "py-20 text-center"}>
      <div className="mx-auto mb-4 flex size-[88px] items-center justify-center rounded-full bg-primary-tint-light">
        <div className="flex size-14 items-center justify-center rounded-full bg-primary-tint-strong"><Inbox className="size-8 text-primary" /></div>
      </div>
      <p className="font-semibold">{tc("emptyState.title")}</p>
      <p className="mt-1 text-muted-foreground">
        {suffix ? tc("emptyState.messageWithSuffix", { what: noun, suffix }) : tc("emptyState.message", { what: noun })}
        {onWiden && (
          <><br />{tc("emptyState.widenBefore")} <button type="button" className="text-primary hover:underline" onClick={onWiden}>{tc("emptyState.widenLink")}</button>{" "}{tc("emptyState.widenAfter")}</>
        )}
      </p>
    </div>
  );
}

/** Dòng bảng chứa ListEmptyState (chiếm cả cols cột) — dùng trong <tbody> của bảng danh sách / bảng con panel chi tiết. */
export function ListEmptyRow({ cols, ...props }: { cols: number } & React.ComponentProps<typeof ListEmptyState>) {
  return <tr className="hover:bg-transparent"><td colSpan={cols} className="p-0 whitespace-normal"><ListEmptyState {...props} /></td></tr>;
}
