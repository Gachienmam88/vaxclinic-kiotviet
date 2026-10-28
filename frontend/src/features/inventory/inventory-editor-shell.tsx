"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductPicker } from "@/features/purchases/search-pickers";
import type { ProductDetail } from "@/features/products/product-types";
import { useT } from "@/lib/i18n";
import { inventoryNs } from "@/messages/inventory";

/** Ô nhập/chọn cột phải: cao 30px, viền xám, bo 6px (giống PurchaseEditorPanel). */
export const PANEL_FIELD = "h-[30px] w-full rounded-md border border-[#d1d5db] bg-background px-2 text-[13px] outline-none placeholder:text-muted-foreground focus-visible:border-primary disabled:opacity-60";

/** 1 dòng nhãn — giá trị ở cột phải màn soạn phiếu. */
export function PanelRow({ label, children, strong }: { label: string; children: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex min-h-[34px] items-center justify-between gap-3 text-[13px]">
      <span className={strong ? "font-bold" : undefined}>{label}</span>
      <div className="w-[150px] text-right">{children}</div>
    </div>
  );
}

/**
 * Khung màn soạn phiếu kho toàn trang (như màn Nhập hàng): tiêu đề + ô tìm hàng (F3), bảng dòng bên trái,
 * cột phải 330px với thông tin phiếu và 2 nút "Lưu tạm" / "Hoàn thành".
 */
export function InventoryEditorShell({ title, listPath, onPick, toolbar, empty, panel, saving, onSave, children }: {
  title: string; listPath: string; onPick: (p: ProductDetail) => void; toolbar?: React.ReactNode; empty: boolean;
  panel: React.ReactNode; saving: boolean; onSave: (complete: boolean) => void; children: React.ReactNode;
}) {
  const router = useRouter();
  const t = useT(inventoryNs);
  return (
    <div className="flex min-h-[calc(100vh-110px)] gap-2.5">
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <div className="flex h-8 items-center gap-2.5">
          <Button variant="ghost" size="icon-sm" onClick={() => router.push(listPath)} aria-label={t("editor.back")}><ArrowLeft /></Button>
          <h1 className="text-lg font-bold">{title}</h1>
          <ProductPicker onPick={onPick} />
        </div>
        {toolbar}
        <div className="flex-1 overflow-x-auto rounded-lg bg-background">
          {children}
          {empty && (
            <div className="py-40 text-center text-[13px] text-muted-foreground">
              {t("editor.emptyHint")}
            </div>
          )}
        </div>
      </div>
      <aside className="flex w-[330px] shrink-0 flex-col gap-3 self-stretch rounded-lg bg-background p-2.5">
        {panel}
        <div className="mt-auto grid grid-cols-2 gap-2.5 pt-2">
          <Button variant="outline" className="h-[38px] rounded-lg border-primary bg-background text-sm font-semibold text-primary hover:bg-primary/5 hover:text-primary"
            disabled={saving} onClick={() => onSave(false)}>
            {t("editor.saveDraft")}
          </Button>
          <Button className="h-[38px] rounded-lg text-sm font-semibold" disabled={saving} onClick={() => onSave(true)}>{t("editor.complete")}</Button>
        </div>
      </aside>
    </div>
  );
}
