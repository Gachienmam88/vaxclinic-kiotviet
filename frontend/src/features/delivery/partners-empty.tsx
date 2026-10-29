"use client";

import { Inbox } from "lucide-react";
import { useT } from "@/lib/i18n";
import { deliveryNs } from "@/messages/delivery";

/** Trạng thái trống của bảng đối tác (KiotViet): giữ hàng tiêu đề, giữa bảng biểu tượng hộp + "Không tìm thấy kết quả nào phù hợp". */
export function PartnersEmpty({ cols }: { cols: string[] }) {
  const t = useT(deliveryNs);
  return (
    <div>
      <div className="flex h-9 items-center gap-6 bg-primary-tint px-4 text-[13px] font-semibold">
        {cols.map((c) => <span key={c} className="flex-1 truncate">{c}</span>)}</div>
      <div className="flex flex-col items-center gap-3 py-24 text-[13px]">
        <span className="grid size-20 place-items-center rounded-full bg-[#f4f0f8]"><Inbox className="size-9 text-primary/70" /></span>
        <b>{t("kv.partners.empty")}</b>
      </div>
    </div>
  );
}
