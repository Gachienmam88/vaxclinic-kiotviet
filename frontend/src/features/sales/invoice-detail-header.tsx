"use client";

import Link from "next/link";
import { SquareArrowOutUpRight } from "lucide-react";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { DOC_CODE_LINK_CLASS, DocCodeLink, docCodeHref } from "@/components/ui/doc-code-link";
import { useSalesChannels } from "@/features/delivery/delivery-queries";
import { useUserLookup } from "@/features/purchases/purchase-queries";
import { useBranches, useShopSettings } from "@/features/settings/settings-queries";
import { STATE_TONE, stateLabel } from "./invoice-filter-model";
import { StatusBadge } from "./invoice-list-kit";
import type { Invoice, InvoiceState } from "./sales-types";

const FIELD = "h-[30px] w-full rounded-md border bg-background px-2 text-[13px] outline-none focus-visible:border-primary disabled:bg-muted/40";
const ROW = "flex min-h-[30px] items-center gap-2";
const LABEL = "w-20 shrink-0 text-muted-foreground";

/** Các trường sửa được ngay trong chi tiết (nút Lưu). */
export type InvoiceInfoDraft = { sellerId: string; at: string; channel: string; note: string };

/**
 * Đầu chi tiết hóa đơn như KiotViet: "<Mã KH> - <Tên KH>" ↗, mã HĐ, trạng thái, chi nhánh;
 * Người tạo | Người bán (chọn) | Ngày bán (ngày giờ) / Kênh bán (chọn) | Bảng giá.
 */
export function InvoiceDetailHeader({ inv, state, f, set, editable }: {
  inv: Invoice; state: InvoiceState; f: InvoiceInfoDraft; set: (p: Partial<InvoiceInfoDraft>) => void; editable: boolean;
}) {
  const { data: users = [] } = useUserLookup();
  const { data: branches = [] } = useBranches();
  const { data: channels = [] } = useSalesChannels(true);
  const { data: settings } = useShopSettings();
  const timeLocked = !!settings?.sales.lockTransactionTime;
  // Kênh đã ngừng hoạt động: chỉ giữ được kênh cũ của hóa đơn
  const channelOptions = channels.filter((c) => c.active || c.code === inv.salesChannel);
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-base font-bold">
          {inv.customerCode && <><DocCodeLink code={inv.customerCode} kind="/customers" /> - </>}{inv.customerName}</span>
        {inv.customerCode && (
          <Link href={docCodeHref(inv.customerCode, "/customers")!} target="_blank" className={DOC_CODE_LINK_CLASS}
            aria-label="Mở khách hàng ở tab mới" title="Mở khách hàng ở tab mới"><SquareArrowOutUpRight className="size-4" /></Link>)}
        <span>{inv.code}</span>
        <StatusBadge tone={STATE_TONE[state]}>{stateLabel(state)}</StatusBadge>
        {inv.offline && <StatusBadge tone="gray">Bán offline</StatusBadge>}
        {inv.orderCode && <StatusBadge tone="blue">Từ đơn đặt hàng <DocCodeLink code={inv.orderCode} kind="/orders" /></StatusBadge>}
        <span className="ml-auto">{branches.find((b) => b.id === inv.branchId)?.name}</span>
      </div>
      <div className="grid grid-cols-1 gap-x-8 gap-y-2 text-xs md:grid-cols-3">
        <div className={ROW}><span className={LABEL}>Người tạo:</span>{inv.createdByName}</div>
        <div className={ROW}><span className={LABEL}>Người bán:</span>
          <select className={FIELD} aria-label="Người bán" value={f.sellerId} disabled={!editable} onChange={(e) => set({ sellerId: e.target.value })}>
            {!f.sellerId && <option value="">{inv.sellerName ?? "Chọn người bán"}</option>}
            {users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}</select></div>
        <div className={ROW} title={timeLocked ? "Cửa hàng không cho phép thay đổi thời gian giao dịch (Thiết lập → Đơn hàng)" : undefined}>
          <span className={LABEL}>Ngày bán:</span>
          <DateTimePicker aria-label="Ngày bán" className={FIELD} value={f.at} disabled={!editable || timeLocked} onChange={(v) => v && set({ at: v })} /></div>
        <div className={ROW}><span className={LABEL}>Kênh bán:</span>
          <select className={FIELD} aria-label="Kênh bán" value={f.channel} disabled={!editable} onChange={(e) => set({ channel: e.target.value })}>
            {!channelOptions.some((c) => c.code === f.channel) && <option value={f.channel}>{inv.salesChannelName}</option>}
            {channelOptions.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</select></div>
        <div className={ROW}><span className={LABEL}>Bảng giá:</span>{inv.priceBookName ?? "Bảng giá chung"}</div>
      </div>
    </>
  );
}
