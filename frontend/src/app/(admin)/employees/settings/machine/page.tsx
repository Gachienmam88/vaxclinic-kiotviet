"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SettingsCard, SettingsPage } from "@/features/settings/settings-layout-parts";
import { useBranches } from "@/features/settings/settings-queries";
import type { MachineImportResult } from "@/features/hr/hr-types";
import { ApiRequestError, errorMessage } from "@/lib/api-client";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Máy chấm công vân tay / khuôn mặt: thay vì phần mềm kết nối của KiotViet, xuất file log từ máy (CSV / TXT / XLSX)
 * rồi nhập vào đây. Mỗi lượt quét được ghép vào ca theo Mã chấm công của nhân viên.
 */
export default function MachineSettingsPage() {
  const qc = useQueryClient();
  const { data: branches = [] } = useBranches();
  const fileRef = useRef<HTMLInputElement>(null);
  const [branchId, setBranchId] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<MachineImportResult | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      if (branchId) form.append("branchId", branchId);
      const res = await fetch("/api/backend/hr/attendance/import", { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new ApiRequestError(res.status, body.code ?? "UNKNOWN", body.message ?? "Nhập file thất bại", body.details);
      setResult(body as MachineImportResult);
      toast.success(`Đã ghi nhận ${(body as MachineImportResult).records} lượt chấm công`);
      qc.invalidateQueries({ queryKey: ["hr"] });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const step = (n: number, text: React.ReactNode) => (
    <p className="flex items-start gap-2"><span className="shrink-0 rounded bg-[#eff0f3] px-1.5 py-0.5 text-[12px] font-medium">Bước {n}</span><span>{text}</span></p>
  );
  return (
    <SettingsPage toc={[{ id: "machine", label: "Chấm công vân tay" }]}>
      <SettingsCard id="machine" title="Cài đặt máy chấm công vân tay" description="Kết nối với máy chấm công để ghi nhận dữ liệu chấm công lên phần mềm">
        <div className="space-y-3 px-5 py-4 text-[13px]">
          <p>Để triển khai chấm công bằng máy chấm công cho cửa hàng, vui lòng xem hướng dẫn dưới đây:</p>
          {step(1, "Nhập Mã chấm công cho từng nhân viên trùng với mã (User ID / AC-No.) đã đăng ký trên máy chấm công.")}
          {step(2, "Trên máy chấm công hoặc phần mềm đi kèm, xuất dữ liệu chấm công ra file CSV, TXT hoặc Excel (.xlsx) gồm cột Mã chấm công và Thời gian (hoặc Ngày + Giờ).")}
          {step(3, "Chọn file bên dưới. Mỗi lượt quét được ghép vào ca làm việc phù hợp: giờ vào = lần quét sớm nhất, giờ ra = lần quét muộn nhất trong ca.")}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <select aria-label="Chi nhánh đặt máy" className="h-[30px] w-60 rounded-md border border-[#d9dbe0] bg-white px-2 text-[13px]"
              value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">Chi nhánh đặt máy (không bắt buộc)</option>
              {branches.filter((b) => b.active).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <input ref={fileRef} type="file" accept=".csv,.txt,.xlsx" className="hidden" aria-label="File dữ liệu chấm công"
              onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            <Button disabled={busy} onClick={() => fileRef.current?.click()}><Upload className="size-4" /> {busy ? "Đang nhập…" : "Chọn file dữ liệu chấm công"}</Button>
          </div>
          {result && (
            <div className="rounded-md border bg-[#f8fafc] p-3 leading-6">
              <p>Đọc {result.rows} dòng · {result.punches} lượt quét hợp lệ · <b>{result.records} lượt chấm công được ghi nhận</b></p>
              {result.unmatched > 0 && <p className="text-[#b45309]">{result.unmatched} lượt quét không khớp ca làm việc nào (ngoài khung giờ ca)</p>}
              {result.unknownCodes.length > 0 && <p className="text-[#b45309]">Mã chấm công chưa gán cho nhân viên: {result.unknownCodes.join(", ")}</p>}
              {result.errors.map((e) => <p key={e} className="text-destructive">{e}</p>)}
            </div>
          )}
        </div>
      </SettingsCard>
    </SettingsPage>
  );
}
