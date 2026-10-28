"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Info, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DETAIL_BTN, StatusBadge } from "@/features/sales/invoice-list-kit";
import { api, errorMessage } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import { useTaxConnections, type TaxConnection } from "./integration-queries";

const PORTAL = "https://hoadondientu.gdt.gov.vn/";

/** Tab "Danh sách kết nối": thẻ từng kết nối cổng thuế (MST, tài khoản, đồng bộ lần cuối, sửa / xóa). */
export function TaxConnectionList({ onEdit }: { onEdit: (c: TaxConnection) => void }) {
  const qc = useQueryClient();
  const { data = [] } = useTaxConnections();
  const remove = useMutation({
    mutationFn: (id: string) => api(`/tax-connections/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tax-connections"] }),
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div className="space-y-3 text-[13px]">
      <p className="flex items-center justify-center gap-2 rounded bg-primary-tint px-3 py-1.5 text-primary">
        <Info className="size-4 shrink-0" /> Lưu ý: Bạn có thể kết nối nhiều tài khoản để quản lý hóa đơn của nhiều doanh nghiệp cùng lúc.</p>
      {!data.length && <p className="py-8 text-center text-muted-foreground">Chưa có kết nối nào — bấm “Thêm kết nối”</p>}
      {data.map((c) => (
        <div key={c.id} className="rounded-lg border bg-background px-5 py-4">
          <div className="flex items-center gap-2 font-semibold">Kết nối Cơ quan Thuế
            <StatusBadge tone={c.lastError ? "red" : "green"}>{c.lastError ? "Lỗi đồng bộ" : "Đang hoạt động"}</StatusBadge></div>
          <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-3 md:grid-cols-4">
            <Field label="Website"><a href={PORTAL} target="_blank" rel="noreferrer" className="text-primary hover:underline">{PORTAL}</a></Field>
            <Field label="Mã số thuế">{c.taxCode}</Field>
            <Field label="Tên đăng nhập">{c.username}</Field>
            <Field label="Mật khẩu">******</Field>
          </div>
          {c.lastError && <p className="mt-2 text-xs text-destructive">{c.lastError}</p>}
          <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t pt-2.5">
            <span>Đồng bộ lần cuối: {c.lastSyncedAt ? formatDateTime(c.lastSyncedAt) : "chưa đồng bộ"}</span>
            <Button variant="outline" className={`${DETAIL_BTN} ml-auto`} onClick={() => onEdit(c)}><Pencil className="size-3.5" /> Sửa thiết lập</Button>
            <Button variant="outline" className={DETAIL_BTN} onClick={() => confirm(`Xóa kết nối MST ${c.taxCode}?`) && remove.mutate(c.id)}>
              <Trash2 className="size-3.5" /> Xóa</Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2 border-b pb-2"><div className="text-xs">{label}</div><div className="truncate">{children}</div></div>;
}
