"use client";

import { TabsList } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";

/**
 * Thanh tab của panel chi tiết mở dưới dòng (KiotViet): bấm lại tab đang mở → onActiveTabClick (đóng panel).
 * Chuột lẫn bàn phím (Enter/Space trên tab đang chọn đều sinh sự kiện click). Bắt ở pha capture nên đọc được
 * aria-selected TRƯỚC khi base-ui đổi tab — bấm tab khác chỉ chuyển tab như cũ.
 */
export function DetailTabsList({ onActiveTabClick, ...props }: React.ComponentProps<typeof TabsList> & { onActiveTabClick?: () => void }) {
  return (
    <TabsList {...props} onClickCapture={(e) => {
      const tab = (e.target as HTMLElement).closest('[role="tab"]');
      if (onActiveTabClick && tab?.getAttribute("aria-selected") === "true") onActiveTabClick();
    }} />
  );
}

/** Panel chỉ có 1 tab tĩnh ("Thông tin"): nút gạch chân xanh, bấm → onClick (đóng panel). */
export function DetailSingleTab({ label, onClick, className }: { label?: string; onClick?: () => void; className?: string }) {
  const tc = useT(commonNs);
  return (
    <button type="button" aria-expanded onClick={onClick} title={onClick ? tc("actions.collapse") : undefined}
      className={cn("inline-block cursor-pointer border-b-2 border-primary py-2 font-semibold text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring/50", className)}>
      {label ?? tc("detailTabs.info")}
    </button>
  );
}
