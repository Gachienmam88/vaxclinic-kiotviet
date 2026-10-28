"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, errorMessage } from "@/lib/api-client";
import type { TaxConnection } from "./integration-queries";

/** Thêm / sửa kết nối cổng hóa đơn điện tử của cơ quan thuế (MST + tài khoản + mật khẩu). */
export function TaxConnectionDialog({ connection, onClose }: { connection?: TaxConnection; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ taxCode: connection?.taxCode ?? "", username: connection?.username ?? "", password: "" });
  const save = useMutation({
    mutationFn: () => connection
      ? api(`/tax-connections/${connection.id}`, { method: "PUT", body: f })
      : api("/tax-connections", { method: "POST", body: f }),
    onSuccess: () => { toast.success("Đã lưu kết nối"); qc.invalidateQueries({ queryKey: ["tax-connections"] }); onClose(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{connection ? "Sửa thiết lập kết nối" : "Thêm kết nối Cơ quan Thuế"}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Tài khoản đăng nhập https://hoadondientu.gdt.gov.vn. Mật khẩu được mã hóa khi lưu.</p>
        <div className="grid gap-3">
          <div className="grid gap-1.5"><Label>Mã số thuế</Label><Input value={f.taxCode} onChange={(e) => setF({ ...f, taxCode: e.target.value, username: f.username || e.target.value })} /></div>
          <div className="grid gap-1.5"><Label>Tên đăng nhập</Label><Input value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} /></div>
          <div className="grid gap-1.5"><Label>Mật khẩu {connection && "(bỏ trống nếu giữ nguyên)"}</Label>
            <Input type="password" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Bỏ qua</Button>
          <Button disabled={save.isPending || !f.taxCode || !f.username || (!connection && !f.password)} onClick={() => save.mutate()}>Lưu</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);

/**
 * Đồng bộ hóa đơn đầu vào: lấy captcha từ cổng thuế → người dùng gõ mã → đồng bộ khoảng ngày (tối đa 1 tháng).
 * Captcha hiển thị bằng <img> từ data URL (SVG trong <img> không chạy được script).
 */
export function SyncDialog({ connections, onClose }: { connections: TaxConnection[]; onClose: () => void }) {
  const qc = useQueryClient();
  const now = new Date();
  const [connectionId, setConnectionId] = useState(connections[0]?.id ?? "");
  const [from, setFrom] = useState(iso(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [to, setTo] = useState(iso(now));
  const [captcha, setCaptcha] = useState<{ key: string; svg: string } | null>(null);
  const [value, setValue] = useState("");

  const loadCaptcha = useMutation({
    mutationFn: () => api<{ key: string; svg: string }>(`/tax-connections/${connectionId}/captcha`, { method: "POST" }),
    onSuccess: (c) => { setCaptcha(c); setValue(""); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const sync = useMutation({
    mutationFn: () => api<{ found: number; added: number }>(`/tax-connections/${connectionId}/sync`, { method: "POST",
      body: { captchaKey: captcha!.key, captchaValue: value, from, to } }),
    onSuccess: (r) => {
      toast.success(`Đã đồng bộ: ${r.found} hóa đơn, ${r.added} hóa đơn mới`);
      qc.invalidateQueries({ queryKey: ["input-invoices"] });
      qc.invalidateQueries({ queryKey: ["tax-connections"] });
      onClose();
    },
    onError: (e) => { toast.error(errorMessage(e)); loadCaptcha.mutate(); qc.invalidateQueries({ queryKey: ["tax-connections"] }); },
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Đồng bộ hóa đơn đầu vào</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5"><Label>Kết nối (mã số thuế)</Label>
            <select className="h-8 rounded-md border px-2 text-sm" value={connectionId} onChange={(e) => { setConnectionId(e.target.value); setCaptcha(null); }}>
              {connections.map((c) => <option key={c.id} value={c.id}>{c.taxCode}</option>)}
            </select></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>Từ ngày</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div className="grid gap-1.5"><Label>Đến ngày</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          </div>
          <div className="grid gap-1.5">
            <Label>Mã captcha của cổng thuế</Label>
            <div className="flex items-center gap-2">
              {captcha
                ? <img alt="captcha" className="h-12 rounded border bg-white" src={`data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(captcha.svg)))}`} />
                : <span className="text-sm text-muted-foreground">Bấm "Lấy mã" để hiện captcha</span>}
              <Button type="button" variant="outline" size="sm" disabled={!connectionId || loadCaptcha.isPending} onClick={() => loadCaptcha.mutate()}>
                <RefreshCw className="size-3.5" /> Lấy mã</Button>
            </div>
            <Input placeholder="Nhập mã trong ảnh" value={value} disabled={!captcha} onChange={(e) => setValue(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Bỏ qua</Button>
          <Button disabled={!captcha || !value || sync.isPending} onClick={() => sync.mutate()}>{sync.isPending ? "Đang đồng bộ..." : "Đồng bộ"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
