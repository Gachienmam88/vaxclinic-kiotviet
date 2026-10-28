"use client";

import { useRouter } from "next/navigation";
import { ExternalLink, FileOutput, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DocStatusBadge } from "@/features/purchases/purchase-list-chrome";
import { useBranches } from "@/features/settings/settings-queries";

/** Dòng nhãn: giá trị trong khối thông tin của panel chi tiết. */
export function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[26px] items-center gap-2 text-xs">
      <span className="w-[95px] shrink-0">{label}:</span><div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** Panel chi tiết mở dưới dòng (viền xanh, tab "Thông tin", mã + trạng thái + chi nhánh) — như Mua hàng. */
export function InventoryDetailFrame({ code, status, statusLabel, branchId, children, footer }: {
  code: string; status: string; statusLabel: string; branchId: string; children: React.ReactNode; footer?: React.ReactNode;
}) {
  const { data: branches = [] } = useBranches();
  return (
    <div className="border border-primary bg-background text-[13px]">
      <div className="border-b border-[#e5e7eb] px-4">
        <span className="inline-block border-b-2 border-primary py-2 font-semibold text-primary">Thông tin</span>
      </div>
      <div className="space-y-4 p-4">
        <div className="flex items-center gap-3">
          <span className="text-base font-bold">{code}</span>
          <DocStatusBadge status={status} label={statusLabel} />
          <span className="ml-auto">{branches.find((b) => b.id === branchId)?.name}</span>
        </div>
        {children}
      </div>
      {footer && <div className="flex flex-wrap items-center gap-1 border-t border-[#e5e7eb] px-2 py-2.5">{footer}</div>}
    </div>
  );
}

/** Chân panel: Hủy (trái), Mở phiếu (phiếu tạm) + Xuất file (phải). */
export function InventoryDetailActions({ canManage, canCancel, cancelText, onCancel, cancelling, editHref, onExport }: {
  canManage: boolean; canCancel: boolean; cancelText: string; onCancel: () => void; cancelling: boolean;
  editHref?: string; onExport: () => void;
}) {
  const router = useRouter();
  return (
    <>
      {canManage && canCancel && (
        <Button variant="ghost" disabled={cancelling} onClick={() => confirm(cancelText) && onCancel()}>
          <Trash2 className="size-4" /> Hủy</Button>
      )}
      <div className="ml-auto flex gap-2">
        {canManage && editHref && (
          <Button className="h-[30px] rounded-md px-3" onClick={() => router.push(editHref)}>
            <ExternalLink className="size-4" /> Mở phiếu</Button>
        )}
        <Button variant="outline" className="h-[30px] rounded-md px-3" onClick={onExport}>
          <FileOutput className="size-4" /> Xuất file</Button>
      </div>
    </>
  );
}
