"use client";

import { useRef, useState } from "react";
import { FileDown, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { downloadCsv } from "@/features/sales/customer-csv-export";
import { kvDialog, kvDialogFooter, kvDialogHeader, kvDialogTitle, kvFooterBtn } from "@/features/sales/customer-ui-primitives";
import { cn } from "@/lib/utils";
import { useInvalidateSuppliers } from "./supplier-queries";

type Result = { created: number; updated: number; errors: { row: number; message: string }[] };
export const SUPPLIER_IMPORT_HEADER = ["Mã nhà cung cấp", "Tên nhà cung cấp", "Điện thoại", "Email", "Địa chỉ", "Khu vực", "Phường/Xã",
  "Nhóm nhà cung cấp", "Tên công ty", "Mã số thuế", "Số CCCD/CMND", "Ghi chú"];

/** Import NCC từ file Excel (.xlsx) / CSV: cập nhật theo mã NCC, mã trống hoặc chưa có → thêm mới; hiện lỗi từng dòng. */
export function SupplierImportDialog({ onClose }: { onClose: () => void }) {
  const invalidate = useInvalidateSuppliers();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function upload() {
    if (!file) return;
    setPending(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/backend/suppliers/import", { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(body.message ?? "Import thất bại"); return; }
      setResult(body as Result);
      toast.success(`Đã thêm ${body.created}, cập nhật ${body.updated} nhà cung cấp`);
      invalidate();
    } catch {
      toast.error("Không gửi được file");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={cn(kvDialog, "sm:max-w-[560px]")}>
        <DialogHeader className={kvDialogHeader}><DialogTitle className={kvDialogTitle}>Nhập nhà cung cấp từ file dữ liệu</DialogTitle></DialogHeader>
        <div className="space-y-3 px-5 pb-4 text-[13px]">
          <p>Tải về file mẫu:{" "}
            <button type="button" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
              onClick={() => downloadCsv("mau-import-nha-cung-cap.csv", SUPPLIER_IMPORT_HEADER, [])}><FileDown className="size-4" /> File CSV mẫu</button></p>
          <p className="text-muted-foreground">Hỗ trợ .xlsx (sheet đầu tiên) hoặc .csv, dòng đầu là tiêu đề. Trùng mã nhà cung cấp → cập nhật thông tin; để trống mã → hệ thống tự sinh mã.</p>
          <input ref={fileRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); }} />
          <Button variant="outline" className="h-8 rounded-md" onClick={() => fileRef.current?.click()}><Upload className="size-4" /> Chọn file dữ liệu</Button>
          {file && <span className="ml-2">{file.name}</span>}
          {result && (
            <div className="rounded-md border border-[#e5e7eb] bg-[#f7f8fa] p-3">
              <p>Thêm mới <b>{result.created}</b> · Cập nhật <b>{result.updated}</b> · Lỗi <b className="text-destructive">{result.errors.length}</b></p>
              {result.errors.length > 0 && (
                <ul className="mt-2 max-h-40 list-disc space-y-0.5 overflow-y-auto pl-5 text-destructive">
                  {result.errors.map((e) => <li key={e.row}>Dòng {e.row}: {e.message}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>
        <DialogFooter className={kvDialogFooter}>
          <Button variant="outline" className={kvFooterBtn} onClick={onClose}>{result ? "Đóng" : "Bỏ qua"}</Button>
          <Button className={kvFooterBtn} disabled={!file || pending} onClick={upload}>Nhập file</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
