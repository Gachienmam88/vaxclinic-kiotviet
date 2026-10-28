"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { useCategories, usePositions } from "@/features/products/product-queries";
import { CategoryManagerDialog, PositionManagerDialog } from "@/features/settings/catalog-list-dialogs";
import { SettingRow, SettingsCard, SettingsPage } from "@/features/settings/settings-shell";
import { useCurrentUser } from "@/lib/use-current-user";

function Count({ text, onClick }: { text: string; onClick?: () => void }) {
  return (
    <button type="button" disabled={!onClick} onClick={onClick}
      className="flex items-center gap-1 text-sm font-medium enabled:hover:text-primary disabled:cursor-default">
      {text} {onClick && <ChevronRight className="size-4 text-muted-foreground" />}
    </button>
  );
}

/** Thiết lập → Hàng hóa: nhóm hàng, vị trí lưu trữ, phương pháp giá vốn. */
export default function ProductSettingsPage() {
  const { data: categories = [] } = useCategories();
  const { data: positions = [] } = usePositions();
  const { can } = useCurrentUser();
  const [dialog, setDialog] = useState<"categories" | "positions" | null>(null);
  const manage = can("catalog.manage");

  return (
    <SettingsPage toc={[{ id: "info", label: "Thông tin hàng hóa" }, { id: "cost", label: "Giá vốn, tồn kho" }]}>
      <SettingsCard id="info" title="Thông tin hàng hóa">
        <SettingRow title="Nhóm hàng" description="Quản lý hàng hóa theo chủng loại, đặc tính, công năng."
          control={<Count text={categories.length ? `${categories.length} nhóm hàng` : "Chưa có nhóm hàng"}
            onClick={manage ? () => setDialog("categories") : undefined} />} />
        <SettingRow title="Vị trí" description="Quản lý hàng hóa theo vị trí lưu trữ như tủ lạnh, kệ, ngăn."
          control={<Count text={positions.length ? `${positions.length} vị trí` : "Chưa có vị trí"}
            onClick={manage ? () => setDialog("positions") : undefined} />} />
        <SettingRow title="Đơn vị tính" description="Mỗi hàng hóa có đơn vị cơ bản (VD: Liều) và các đơn vị quy đổi (VD: Hộp = 10 Liều), khai báo trong từng hàng hóa." />
        <SettingRow title="Quản lý theo lô, hạn sử dụng" description="Bật cho từng hàng hóa. Hàng theo lô bán theo nguyên tắc hết hạn trước xuất trước (FEFO) và không bán lô đã hết hạn." />
      </SettingsCard>
      <SettingsCard id="cost" title="Giá vốn, tồn kho">
        <SettingRow title="Phương pháp tính giá vốn" control={<span className="text-sm font-medium">Giá vốn trung bình</span>}
          description="Giá vốn được tính lại sau mỗi lần nhập hàng / trả hàng nhập theo bình quân gia quyền (giá nhập đã gồm VAT)." />
      </SettingsCard>
      {dialog === "categories" && <CategoryManagerDialog onClose={() => setDialog(null)} />}
      {dialog === "positions" && <PositionManagerDialog onClose={() => setDialog(null)} />}
    </SettingsPage>
  );
}
