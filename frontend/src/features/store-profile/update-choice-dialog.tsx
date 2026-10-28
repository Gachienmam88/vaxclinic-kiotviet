"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { storeProfileNs } from "@/messages/store-profile";
import { FlowFooter } from "./store-flow-parts";

export type UpdateChoice = "profile" | "phone" | "rename" | "transfer";

/** Tiêu đề / gợi ý: khóa updateChoice.options.<value>.title|hint (namespace store-profile). */
const OPTIONS: { value: UpdateChoice; hint?: "profile" | "rename" | "transfer"; ownerOnly?: boolean }[] = [
  { value: "profile", hint: "profile" },
  { value: "phone" },
  { value: "rename", hint: "rename", ownerOnly: true },
  { value: "transfer", hint: "transfer", ownerOnly: true },
];

/** "Bạn muốn cập nhật thông tin?" (ảnh 179): chọn 1 loại cập nhật rồi Tiếp tục. */
export function UpdateChoiceDialog({ isOwner, onClose, onChoose }: {
  isOwner: boolean; onClose: () => void; onChoose: (c: UpdateChoice) => void;
}) {
  const [value, setValue] = useState<UpdateChoice>("profile");
  const t = useT(storeProfileNs);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-3 sm:max-w-[520px]">
        <DialogHeader><DialogTitle className="text-[17px] font-semibold">{t("updateChoice.title")}</DialogTitle></DialogHeader>
        <p className="text-[13px]">{t("updateChoice.prompt")}</p>
        <div role="radiogroup" className="space-y-2">
          {OPTIONS.map((o) => {
            const disabled = !!o.ownerOnly && !isOwner;
            return (
              <label key={o.value} className={cn("flex min-h-[52px] cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5",
                value === o.value ? "border-primary ring-1 ring-primary/30" : "border-border", disabled && "cursor-not-allowed opacity-60")}>
                <input type="radio" name="update-choice" className="mt-0.5 size-4 accent-primary" checked={value === o.value}
                  disabled={disabled} onChange={() => setValue(o.value)} />
                <span>
                  <span className="block text-[13px] font-semibold">{t(`updateChoice.options.${o.value}.title`)}</span>
                  {o.hint && <span className="mt-0.5 block text-[11px] text-muted-foreground">{t(`updateChoice.options.${o.hint}.hint`)}</span>}
                  {disabled && <span className="mt-0.5 block text-[11px] text-muted-foreground">{t("updateChoice.ownerOnly")}</span>}
                </span>
              </label>
            );
          })}
        </div>
        <FlowFooter onCancel={onClose} cancelLabel={t("flow.skip")} nextLabel={t("flow.next")} onNext={() => onChoose(value)} />
      </DialogContent>
    </Dialog>
  );
}
