"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { FlowFooter } from "./store-flow-parts";

export type UpdateChoice = "profile" | "phone" | "rename" | "transfer";

const OPTIONS: { value: UpdateChoice; title: string; hint?: string; ownerOnly?: boolean }[] = [
  { value: "profile", title: "Cập nhật thông tin hồ sơ", hint: "Email, Số CCCD, Người đại diện, Ngày sinh, Địa chỉ,..." },
  { value: "phone", title: "Cập nhật số điện thoại chủ gian hàng" },
  { value: "rename", title: "Đổi tên gian hàng", hint: "Thay đổi địa chỉ truy cập hệ thống", ownerOnly: true },
  { value: "transfer", title: "Chuyển nhượng gian hàng",
    hint: "Chuyển quyền chủ gian hàng cho quản trị viên khác. Cần xác thực của chủ gian hàng hiện tại.", ownerOnly: true },
];

/** "Bạn muốn cập nhật thông tin?" (ảnh 179): chọn 1 loại cập nhật rồi Tiếp tục. */
export function UpdateChoiceDialog({ isOwner, onClose, onChoose }: {
  isOwner: boolean; onClose: () => void; onChoose: (c: UpdateChoice) => void;
}) {
  const [value, setValue] = useState<UpdateChoice>("profile");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-3 sm:max-w-[520px]">
        <DialogHeader><DialogTitle className="text-[17px] font-semibold">Bạn muốn cập nhật thông tin?</DialogTitle></DialogHeader>
        <p className="text-[13px]">Lựa chọn thông tin cần cập nhật:</p>
        <div role="radiogroup" className="space-y-2">
          {OPTIONS.map((o) => {
            const disabled = !!o.ownerOnly && !isOwner;
            return (
              <label key={o.value} className={cn("flex min-h-[52px] cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5",
                value === o.value ? "border-primary ring-1 ring-primary/30" : "border-border", disabled && "cursor-not-allowed opacity-60")}>
                <input type="radio" name="update-choice" className="mt-0.5 size-4 accent-primary" checked={value === o.value}
                  disabled={disabled} onChange={() => setValue(o.value)} />
                <span>
                  <span className="block text-[13px] font-semibold">{o.title}</span>
                  {o.hint && <span className="mt-0.5 block text-[11px] text-muted-foreground">{o.hint}</span>}
                  {disabled && <span className="mt-0.5 block text-[11px] text-muted-foreground">Chỉ chủ gian hàng được thực hiện.</span>}
                </span>
              </label>
            );
          })}
        </div>
        <FlowFooter onCancel={onClose} cancelLabel="Bỏ qua" nextLabel="Tiếp tục" onNext={() => onChoose(value)} />
      </DialogContent>
    </Dialog>
  );
}
