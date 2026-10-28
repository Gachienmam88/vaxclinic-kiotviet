"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { useCategories, usePositions } from "@/features/products/product-queries";
import { CategoryManagerDialog, PositionManagerDialog } from "@/features/settings/catalog-list-dialogs";
import { SettingRow, SettingsCard, SettingsPage } from "@/features/settings/settings-shell";
import { useCurrentUser } from "@/lib/use-current-user";
import { useT } from "@/lib/i18n";
import { settingsNs } from "@/messages/settings";

function Count({ text, onClick }: { text: string; onClick?: () => void }) {
  return (
    <button type="button" disabled={!onClick} onClick={onClick}
      className="flex items-center gap-1 text-[13px] font-medium enabled:hover:text-primary disabled:cursor-default">
      {text} {onClick && <ChevronRight className="size-4 text-muted-foreground" />}
    </button>
  );
}

/** Thiết lập → Hàng hóa: nhóm hàng, vị trí lưu trữ, phương pháp giá vốn. */
export default function ProductSettingsPage() {
  const { data: categories = [] } = useCategories();
  const { data: positions = [] } = usePositions();
  const { can } = useCurrentUser();
  const t = useT(settingsNs);
  const [dialog, setDialog] = useState<"categories" | "positions" | null>(null);
  const manage = can("catalog.manage");

  return (
    <SettingsPage toc={[{ id: "info", label: t("products.tocInfo") }, { id: "cost", label: t("products.tocCost") }]}>
      <SettingsCard id="info" title={t("products.tocInfo")}>
        <SettingRow title={t("products.categories")} description={t("products.categoriesDesc")}
          control={<Count text={categories.length ? t("products.categoryCount", { count: categories.length }) : t("products.noCategories")}
            onClick={manage ? () => setDialog("categories") : undefined} />} />
        <SettingRow title={t("products.positions")} description={t("products.positionsDesc")}
          control={<Count text={positions.length ? t("products.positionCount", { count: positions.length }) : t("products.noPositions")}
            onClick={manage ? () => setDialog("positions") : undefined} />} />
        <SettingRow title={t("products.units")} description={t("products.unitsDesc")} />
        <SettingRow title={t("products.lots")} description={t("products.lotsDesc")} />
      </SettingsCard>
      <SettingsCard id="cost" title={t("products.tocCost")}>
        <SettingRow title={t("products.costMethod")} control={<span className="text-[13px] font-medium">{t("products.costMethodValue")}</span>}
          description={t("products.costMethodDesc")} />
      </SettingsCard>
      {dialog === "categories" && <CategoryManagerDialog onClose={() => setDialog(null)} />}
      {dialog === "positions" && <PositionManagerDialog onClose={() => setDialog(null)} />}
    </SettingsPage>
  );
}
