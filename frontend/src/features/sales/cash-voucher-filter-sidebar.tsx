"use client";

import { useUserLookup } from "@/features/purchases/purchase-queries";
import {
  CheckOption, FILTER_FIELD, FilterSection, FilterSidebar, PeriodFilter, PillGroup, RadioOption,
} from "./invoice-list-kit";
import { useCashCategories, type Period } from "./sales-queries";
import { FUND_LABEL } from "./sales-types";

export type CashFilters = {
  fund: string; period: Period; types: string[]; category: string; statuses: string[]; accounting: string;
  createdBy: string; collectorId: string; partnerType: string; partner: string;
};

export const PARTNER_TYPE_OPTIONS = [["CUSTOMER", "Khách hàng"], ["SUPPLIER", "Nhà cung cấp"], ["EMPLOYEE", "Nhân viên"], ["OTHER", "Khác"]] as const;

const toggle = (list: string[], v: string, on: boolean) => (on ? [...list, v] : list.filter((x) => x !== v));

/** Sidebar lọc Sổ quỹ (thứ tự theo KiotViet; chỉ các bộ lọc backend /cashbook hỗ trợ). */
export function CashVoucherFilterSidebar({ value, onChange }: { value: CashFilters; onChange: (f: CashFilters) => void }) {
  const { data: users = [] } = useUserLookup();
  const { data: categories = [] } = useCashCategories();
  const set = (p: Partial<CashFilters>) => onChange({ ...value, ...p });
  return (
    <FilterSidebar>
      <FilterSection title="Quỹ tiền">
        {["CASH", "BANK", "EWALLET", "ALL"].map((f) => (
          <RadioOption key={f} checked={value.fund === f} onSelect={() => set({ fund: f })}>{FUND_LABEL[f]}</RadioOption>))}
      </FilterSection>
      <PeriodFilter value={value.period} onChange={(period) => set({ period })} />
      <FilterSection title="Loại chứng từ">
        {([["RECEIPT", "Phiếu thu"], ["PAYMENT", "Phiếu chi"]] as const).map(([v, l]) => (
          <CheckOption key={v} checked={value.types.includes(v)} onChange={(on) => set({ types: toggle(value.types, v, on) })}>{l}</CheckOption>))}
      </FilterSection>
      <FilterSection title="Loại thu chi">
        <select className={FILTER_FIELD} aria-label="Loại thu chi" value={value.category} onChange={(e) => set({ category: e.target.value })}>
          <option value="">Chọn loại thu chi</option>{categories.map((c) => <option key={c}>{c}</option>)}</select>
      </FilterSection>
      <FilterSection title="Trạng thái">
        {([["PAID", "Đã thanh toán"], ["CANCELLED", "Đã hủy"]] as const).map(([v, l]) => (
          <CheckOption key={v} checked={value.statuses.includes(v)} onChange={(on) => set({ statuses: toggle(value.statuses, v, on) })}>{l}</CheckOption>))}
      </FilterSection>
      <FilterSection title="Hạch toán kết quả kinh doanh">
        <PillGroup value={value.accounting} onChange={(accounting) => set({ accounting })}
          options={[["", "Tất cả"], ["true", "Có"], ["false", "Không"]]} />
      </FilterSection>
      <FilterSection title="Người tạo">
        <select className={FILTER_FIELD} aria-label="Người tạo" value={value.createdBy} onChange={(e) => set({ createdBy: e.target.value })}>
          <option value="">Chọn người tạo</option>{users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}</select>
      </FilterSection>
      <FilterSection title="Nhân viên">
        <select className={FILTER_FIELD} aria-label="Nhân viên thu/chi" value={value.collectorId} onChange={(e) => set({ collectorId: e.target.value })}>
          <option value="">Chọn nhân viên</option>{users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}</select>
      </FilterSection>
      <FilterSection title="Người nộp/nhận">
        <select className={FILTER_FIELD} aria-label="Loại người nộp/nhận" value={value.partnerType} onChange={(e) => set({ partnerType: e.target.value })}>
          <option value="">Tất cả</option>{PARTNER_TYPE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <input className={FILTER_FIELD} placeholder="Tên hoặc số điện thoại" aria-label="Tên hoặc số điện thoại người nộp/nhận"
          value={value.partner} onChange={(e) => set({ partner: e.target.value })} />
      </FilterSection>
    </FilterSidebar>
  );
}
