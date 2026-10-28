"use client";

import { ImageIcon } from "lucide-react";
import { formatMoney, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ProductDetail } from "./product-types";

/** Ô thông tin: nhãn xám 12px, giá trị 13px, gạch chân như panel chi tiết KiotViet. */
export function DetailField({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className="border-b border-[#e5e7eb] pb-2">
      <div className="mb-1.5 text-xs text-muted-foreground">{label}</div>
      <div className={cn("min-h-5 text-[13px]", strong && "font-bold")}>
        {value || <span className="text-muted-foreground">Chưa có</span>}
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
          <p className="text-[13px]"><span className="text-muted-foreground">Nhóm hàng:</span> {p.categoryName}</p>
          <div className="flex flex-wrap gap-1.5">
            <Chip>{p.lotManaged ? "Quản lý theo lô, HSD" : "Hàng hóa thường"}</Chip>
            {base.directSale && <Chip>Bán trực tiếp</Chip>}
            {!p.loyaltyPoints && <Chip className="bg-orange-50 text-orange-600">Không tích điểm</Chip>}
            {!p.active && <Chip className="bg-red-50 text-destructive">Ngừng kinh doanh</Chip>}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-5 gap-y-3 md:grid-cols-4">
        <DetailField label="Mã hàng" value={base.code} strong />
        <DetailField label="Mã vạch" value={base.barcode} />
        <DetailField label="Tồn kho" value={formatNumber(stock)} />
        <DetailField label="Định mức tồn" value={`${formatNumber(p.minStock)} - ${formatNumber(p.maxStock)}`} />
        <DetailField label="Giá vốn" value={formatNumber(p.cost)} />
        <DetailField label="Giá bán" value={formatMoney(base.price)} />
        <DetailField label="Tỷ lệ tính thuế"
          value={p.taxRateName && <span title={p.taxRateName}>{p.taxRateName.split(" ")[0]}</span>} />
        <DetailField label="Áp dụng giảm thuế" value={p.taxReduction ? "Có áp dụng" : "Không áp dụng"} />
        <DetailField label="Vị trí" value={p.positionName} />
        <DetailField label="Trọng lượng" value={p.weight ? `${formatNumber(p.weight)} ${p.weightUnit}` : null} />
        <DetailField label="Tên hàng trên hóa đơn điện tử" value={p.einvoiceName} />
        <DetailField label="Tên viết tắt" value={p.shortName} />
      </div>
    </div>
  );
}
