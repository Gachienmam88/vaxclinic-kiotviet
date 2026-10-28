"use client";

import { useRef, useState } from "react";
import { ImageUp, Syringe } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VnAddressFields } from "@/components/ui/vn-address-fields";
import { SettingsCard, SettingsPage } from "@/features/settings/settings-shell";
import { useSaveSettings, useShopSettings, type StoreInfo } from "@/features/settings/settings-queries";
import { useCurrentUser } from "@/lib/use-current-user";

const EMPTY: StoreInfo = { name: "", phone: null, email: null, address: null, province: null, ward: null, taxCode: null, logo: null, accessCode: null };

/** Thu nhỏ ảnh về tối đa 256px (PNG) để lưu kèm thiết lập và in lên đầu hóa đơn. */
async function shrinkImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, fail) => {
      const i = new Image(); i.onload = () => ok(i); i.onerror = fail; i.src = url;
    });
    const scale = Math.min(1, 256 / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

function Field({ label, value, accent }: { label: string; value: string | null; accent?: boolean }) {
  return (
    <div className="border-b border-[#e3e6ea] pb-2">
      <div className="mb-1 text-[11px] text-muted-foreground">{label}</div>
      <div className={accent ? "text-[13px] text-primary" : "text-[13px]"}>{value || <span className="text-muted-foreground">Chưa có</span>}</div>
    </div>
  );
}

function StoreDialog({ store, accessCode, onClose }: { store: StoreInfo; accessCode: string; onClose: () => void }) {
  const save = useSaveSettings<StoreInfo>("store");
  const [f, setF] = useState({ ...store, accessCode: store.accessCode ?? accessCode });
  const bind = (k: keyof StoreInfo) => ({ value: f[k] ?? "", onChange: (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value }) });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>Sửa thông tin cửa hàng</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 gap-3 text-[13px] md:grid-cols-3">
          <div className="grid gap-1.5 md:col-span-3"><Label>Địa chỉ truy cập (nhập ở bước đầu khi đăng nhập)</Label>
            <Input value={f.accessCode ?? ""} readOnly disabled />
            <span className="text-xs text-muted-foreground">Chỉ chủ gian hàng đổi được tại Hồ sơ cửa hàng → Cập nhật → Đổi tên gian hàng (mọi thiết bị sẽ bị đăng xuất).</span></div>
          <div className="grid gap-1.5 md:col-span-2"><Label>Tên cửa hàng *</Label><Input {...bind("name")} /></div>
          <div className="grid gap-1.5"><Label>Điện thoại</Label><Input {...bind("phone")} /></div>
          <div className="grid gap-1.5"><Label>Email</Label><Input {...bind("email")} /></div>
          <div className="grid gap-1.5"><Label>Mã số thuế</Label><Input {...bind("taxCode")} /></div>
          <VnAddressFields idPrefix="store" fieldClassName="grid gap-1.5" labelClassName="text-sm font-medium leading-none"
            labels={{ province: "Tỉnh/Thành phố" }}
            value={{ address: f.address ?? "", provinceCode: f.provinceCode ?? "", provinceName: f.province ?? "",
              wardCode: f.wardCode ?? "", wardName: f.ward ?? "" }}
            onChange={(v) => setF({ ...f, address: v.address, province: v.provinceName || null, ward: v.wardName || null,
              provinceCode: v.provinceCode || null, wardCode: v.wardCode || null })} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Bỏ qua</Button>
          <Button disabled={!f.name.trim() || (!!f.accessCode && f.accessCode.length < 3) || save.isPending}
            onClick={() => save.mutate({ ...f, accessCode: f.accessCode || null }, { onSuccess: onClose })}>Lưu</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Thiết lập → Thông tin cửa hàng: tên, liên hệ, logo — dùng cho đầu mẫu in. */
export default function StoreInfoPage() {
  const { data } = useShopSettings();
  const { can } = useCurrentUser();
  const save = useSaveSettings<StoreInfo>("store");
  const [editing, setEditing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  if (!data) return <div className="p-6 text-[13px] text-muted-foreground">Đang tải...</div>;
  const s = data.store ?? { ...EMPTY, name: process.env.NEXT_PUBLIC_APP_NAME ?? "" };
  const editable = can("settings.manage");

  async function pickLogo(file: File | undefined) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("Ảnh không quá 2MB"); return; }
    try {
      save.mutate({ ...s, logo: await shrinkImage(file) });
    } catch {
      toast.error("Không đọc được ảnh");
    }
  }

  return (
    <SettingsPage toc={[{ id: "store", label: "Thông tin cửa hàng" }]}>
      <SettingsCard id="store" title="Thông tin cửa hàng"
        action={editable && <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Chỉnh sửa</Button>}>
        <div className="space-y-5 p-5">
          <div className="flex items-center gap-4">
            <div className="flex size-16 items-center justify-center overflow-hidden rounded-md border bg-muted/40">
              {s.logo ? <img src={s.logo} alt="Logo" className="max-h-full max-w-full object-contain" /> : <Syringe className="size-8 text-primary" />}
            </div>
            {editable && (
              <div>
                <Button variant="outline" size="sm" disabled={save.isPending} onClick={() => fileRef.current?.click()}>
                  <ImageUp className="size-4" /> Chọn ảnh đại diện</Button>
                {s.logo && <Button variant="ghost" size="sm" className="text-destructive" onClick={() => save.mutate({ ...s, logo: null })}>Xóa ảnh</Button>}
                <p className="mt-1 text-xs text-muted-foreground">Lưu ý: Ảnh không quá 2MB. Ảnh được in ở đầu hóa đơn.</p>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { pickLogo(e.target.files?.[0]); e.target.value = ""; }} />
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-3">
            <Field label="Địa chỉ truy cập" value={data.accessCode} accent />
            <Field label="Tên cửa hàng" value={s.name} />
            <Field label="Điện thoại" value={s.phone} />
            <Field label="Email" value={s.email} />
            <Field label="Mã số thuế" value={s.taxCode} />
            <Field label="Quốc gia" value="Việt Nam" />
            <Field label="Địa chỉ" value={[s.address, s.ward, s.province].filter(Boolean).join(", ")} />
          </div>
        </div>
      </SettingsCard>
      {editing && <StoreDialog store={s} accessCode={data.accessCode} onClose={() => setEditing(false)} />}
    </SettingsPage>
  );
}
