"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListEmptyRow } from "@/components/ui/list-empty-state";
import { NativeSelect } from "@/features/products/product-form-sections";
import { useUserLookup } from "@/features/purchases/purchase-queries";
import { SETTINGS_TABLE as T, SettingsCard, SettingsPage } from "@/features/settings/settings-shell";
import { api, type PageResponse } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import { DatePicker } from "@/components/ui/date-picker";
import { DocCodeLink } from "@/components/ui/doc-code-link";

type AuditLog = { id: number; occurredAt: string; userName: string | null; feature: string; action: string; docCode: string | null; detail: string | null };

/** Chi tiết thao tác: mã chứng từ trong câu thành link; câu không chứa mã → thêm mã ở đầu. */
function AuditDetail({ log }: { log: AuditLog }) {
  const { docCode: code, detail } = log;
  if (!code) return <>{detail}</>;
  const i = detail?.indexOf(code) ?? -1;
  if (!detail || i < 0) return <><DocCodeLink code={code} />{detail ? ` ${detail}` : ""}</>;
  return <>{detail.slice(0, i)}<DocCodeLink code={code} />{detail.slice(i + code.length)}</>;
}

const PAGE = 20;

/** Thiết lập → Lịch sử thao tác: ai làm gì, lúc nào (hóa đơn, phiếu thu chi, nhập hàng, thiết lập...). */
export default function AuditLogsPage() {
  const { data: users = [] } = useUserLookup();
  const { data: features = [] } = useQuery({ queryKey: ["audit-features"], queryFn: () => api<string[]>("/audit-logs/features") });
  const [f, setF] = useState({ userId: "", feature: "", from: "", to: "", q: "" });
  const [page, setPage] = useState(0);
  const params = useMemo(() => {
    const p = new URLSearchParams();
    Object.entries(f).forEach(([k, v]) => v && p.set(k, v));
    return p;
  }, [f]);
  const { data } = useQuery({
    queryKey: ["audit-logs", params.toString(), page],
    queryFn: () => api<PageResponse<AuditLog>>(`/audit-logs?${params}&page=${page}&size=${PAGE}`),
  });
  const set = (k: keyof typeof f, v: string) => { setF({ ...f, [k]: v }); setPage(0); };
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE)) : 1;

  async function exportFile() {
    const res = await fetch(`/api/backend/audit-logs/export?${params}`, { headers: { Accept: "text/csv" } });
    if (!res.ok) { toast.error("Không xuất được file"); return; }
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url; a.download = "lich-su-thao-tac.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <SettingsPage hint={<>Rà soát thao tác của nhân viên theo từng tính năng để xác định dấu vết thay đổi khi cần.</>}>
      <SettingsCard title="Lịch sử thao tác" description="Theo dõi tất cả thao tác của nhân viên trên hệ thống.">
        <div className="flex flex-wrap items-center gap-2 px-4 pt-3 text-[13px]">
          <div className="w-44"><NativeSelect aria-label="Nhân viên" value={f.userId} onChange={(e) => set("userId", e.target.value)}>
            <option value="">Tất cả nhân viên</option>{users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}</NativeSelect></div>
          <div className="w-44"><NativeSelect aria-label="Tính năng" value={f.feature} onChange={(e) => set("feature", e.target.value)}>
            <option value="">Tất cả tính năng</option>{features.map((x) => <option key={x}>{x}</option>)}</NativeSelect></div>
          <DatePicker className="h-8 w-36" value={f.from} onChange={(v) => set("from", v)} title="Từ ngày" aria-label="Từ ngày" />
          <DatePicker className="h-8 w-36" value={f.to} onChange={(v) => set("to", v)} title="Đến ngày" aria-label="Đến ngày" />
          <Input className="h-8 w-56" placeholder="Mã chứng từ, nội dung" value={f.q} onChange={(e) => set("q", e.target.value)} aria-label="Tìm mã chứng từ, nội dung" />
          <Button variant="outline" size="sm" className="ml-auto" onClick={exportFile}><Download className="size-4" /> Xuất file</Button>
        </div>
        <div className="p-4">
          <table className={T.table}>
            <thead className={T.head}><tr>
              <th className="w-40">Nhân viên</th><th className="w-40">Tính năng</th><th className="w-40">Thời gian</th><th>Chi tiết</th>
            </tr></thead>
            <tbody>
              {data && !data.items.length && <ListEmptyRow cols={4} what="lịch sử thao tác" compact />}
              {data?.items.map((l) => (
                <tr key={l.id} className={T.row}>
                  <td>{l.userName}</td>
                  <td>{l.feature}<span className="block text-xs text-muted-foreground">{l.action}</span></td>
                  <td>{formatDateTime(l.occurredAt)}</td>
                  <td className="whitespace-normal">{l.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 flex items-center justify-end gap-2 text-[13px]">
            <span className="text-muted-foreground">Tổng {data?.total ?? 0} thao tác — trang {page + 1}/{pages}</span>
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Trước</Button>
            <Button size="sm" variant="outline" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Sau</Button>
          </div>
        </div>
      </SettingsCard>
    </SettingsPage>
  );
}
