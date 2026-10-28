"use client";

import { ImageIcon } from "lucide-react";
import { formatMoney, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { productsNs } from "@/messages/products";
import type { ProductDetail } from "./product-types";

/** Ô thông tin: nhãn xám 12px, giá trị 13px, gạch chân như panel chi tiết KiotViet. */
export function DetailField({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  const t = useT(productsNs);
  return (
    <div className="border-b border-[#e5e7eb] pb-2">
      <div className="mb-1.5 text-xs text-muted-foreground">{label}</div>
      <div className={cn("min-h-5 text-[13px]", strong && "font-bold")}>
        {value || <span className="text-muted-foreground">{t("detail.empty")}</span>}
      </div>
    </div>
  );
}

const Chip = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <span className={cn("rounded bg-[#eff0f3] px-1.5 py-0.5 text-xs font-medium", className)}>{children}</span>
);

/** Tab "Thông tin": ảnh, tên + đơn vị, nhóm hàng, nhãn đặc tính và lưới 4 cột thông tin. */
export function ProductInfoTab({ p }: { p: ProductDetail }) {
  const base = p.units.find((u) => u.base)!;
  const stock = p.stocks.reduce((s, b) => s + Number(b.quantity), 0);
  const t = useT(productsNs);
  return (
    <div className="space-y-5">
      <div className="flex gap-3">
        <div className="flex size-24 shrink-0 items-center justify-center rounded-md bg-primary-tint text-primary">
          <ImageIcon className="size-11" aria-hidden />
        </div>
        <div className="space-y-2 pt-1">
          <h3 className="flex flex-wrap items-center gap-1.5 text-[15px] font-bold">
            {p.name} {p.units.map((u) => <Chip key={u.id}>{u.unitName}</Chip>)}
          </h3>
          <p className="text-[13px]"><span className="text-muted-foreground">{t("detail.categoryLabel")}</span> {p.categoryName}</p>
          <div className="flex flex-wrap gap-1.5">
            <Chip>{p.lotManaged ? t("detail.lotManagedChip") : t("detail.regularChip")}</Chip>
            {base.directSale && <Chip>{t("fields.directSale")}</Chip>}
            {!p.loyaltyPoints && <Chip className="bg-orange-50 text-orange-600">{t("detail.noPoints")}</Chip>}
            {!p.active && <Chip className="bg-red-50 text-destructive">{t("detail.discontinued")}</Chip>}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-5 gap-y-3 md:grid-cols-4">
        <DetailField label={t("fields.code")} value={base.code} strong />
        <DetailField label={t("fields.barcode")} value={base.barcode} />
        <DetailField label={t("fields.stock")} value={formatNumber(stock)} />
        <DetailField label={t("detail.stockLimits")} value={`${formatNumber(p.minStock)} - ${formatNumber(p.maxStock)}`} />
        <DetailField label={t("fields.cost")} value={formatNumber(p.cost)} />
        <DetailField label={t("fields.price")} value={formatMoney(base.price)} />
        <DetailField label={t("fields.taxRate")}
          value={p.taxRateName && <span title={p.taxRateName}>{p.taxRateName.split(" ")[0]}</span>} />
        <DetailField label={t("fields.taxReduction")} value={p.taxReduction ? t("fields.taxReductionYes") : t("fields.taxReductionNo")} />
        <DetailField label={t("fields.position")} value={p.positionName} />
        <DetailField label={t("fields.weight")} value={p.weight ? `${formatNumber(p.weight)} ${p.weightUnit}` : null} />
        <DetailField label={t("fields.einvoiceName")} value={p.einvoiceName} />
        <DetailField label={t("fields.shortName")} value={p.shortName} />
      </div>
    </div>
  );
}
