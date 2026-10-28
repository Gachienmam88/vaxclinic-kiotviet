"use client";

import { PencilLine, UserRound } from "lucide-react";
import { useBranches } from "@/features/settings/settings-queries";
import { formatDate } from "@/lib/format";
import type { Customer } from "./sales-types";

/** Ô thông tin: nhãn nhỏ xám, giá trị bên dưới, gạch chân như KiotViet; trống → "Chưa có". */
function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-[12px] text-foreground/80">{label}</div>
      <div className="min-h-7 border-b border-[#e5e7eb] pb-1.5 text-[13px]">{value || <span className="text-muted-foreground">Chưa có</span>}</div>
    </div>
  );
}

/** Tab "Thông tin" trong chi tiết khách hàng. */
export function CustomerDetailInfoTab({ c }: { c: Customer }) {
  const { data: branches = [] } = useBranches();
  const address = [c.address, c.ward, c.province].filter(Boolean).join(", ");
  const invoiceInfo = [c.companyName ?? c.buyerName ?? c.name, c.taxCode && `MST ${c.taxCode}`,
    [c.invoiceAddress, c.invoiceWard, c.invoiceProvince].filter(Boolean).join(", ") || address].filter(Boolean).join(" / ");
  const sep = <span className="h-3 w-px bg-[#d9dbe0]" />;
  return (
    <div className="space-y-5">
      <div className="flex gap-6">
        <div className="flex size-[124px] shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary">
          <UserRound className="size-16" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1 space-y-3 pt-5">
          <h3 className="flex items-baseline gap-2 text-[16px] font-bold">{c.name}
            <span className="text-[12px] font-normal text-foreground/80">{c.code}</span></h3>
          <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-foreground/80">
            <span>Người tạo: <span className="text-foreground">{c.createdByName}</span></span>{sep}
            <span>Ngày tạo: <span className="text-foreground">{formatDate(c.createdAt)}</span></span>{sep}
            <span>Nhóm khách: {c.groupName ? <span className="text-foreground">{c.groupName}</span> : <span className="text-muted-foreground">Chưa có</span>}</span>
          </p>
        </div>
        <span className="text-[12px] text-foreground/80">{branches.find((b) => b.id === c.branchId)?.name}</span>
      </div>
      <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-3">
        <Field label="Điện thoại" value={[c.phone, c.phone2].filter(Boolean).join(" · ")} />
        <Field label="Sinh nhật" value={formatDate(c.birthday)} />
        <Field label="Giới tính" value={c.gender === "MALE" ? "Nam" : c.gender === "FEMALE" ? "Nữ" : null} />
        <Field label="Email" value={c.email} />
        <Field label="Facebook" value={c.facebook} />
      </div>
      <Field label="Địa chỉ" value={address} />
      <div className="rounded-md border border-[#e5e7eb] bg-[#f7f8fa] px-3 py-2.5 text-[12px]">
        <div className="font-bold">Thông tin xuất hóa đơn</div>
        <p className="mt-2 text-[12px]">{invoiceInfo}</p>
      </div>
      <p className="flex items-center gap-2 text-[12px] text-foreground/80">
        <PencilLine className="size-4" />{c.note || <span className="text-muted-foreground">Chưa có ghi chú</span>}
      </p>
    </div>
  );
}
