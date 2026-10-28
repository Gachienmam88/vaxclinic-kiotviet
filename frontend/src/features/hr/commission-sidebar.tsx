"use client";

import { useState } from "react";
import { CirclePlus, Pencil, Search, Trash2 } from "lucide-react";
import { flattenCategoryTree, useCategories } from "@/features/products/product-queries";
import { FilterSection, FilterSidebar, RadioOption } from "@/features/sales/invoice-list-kit";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useCommissionTables, useHrMutation } from "./hr-queries";
import type { CommissionTable } from "./hr-types";
import { CommissionTableDialog } from "./commission-table-dialog";

export type CommissionView = "PRODUCTS" | "EMPLOYEES";

const searchBox = "h-[30px] w-full rounded-md border border-[#d9dbe0] bg-white pr-2 pl-7 text-[12px] outline-none placeholder:text-muted-foreground focus:border-primary";
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").toLowerCase();

/** Bộ lọc trái Bảng hoa hồng (ảnh 115): Kiểu hiển thị, chọn bảng hoa hồng hiển thị thành cột, Thêm bảng, cây Nhóm hàng. */
export function CommissionSidebar({ view, onView, selected, onSelected, categoryId, onCategory }: {
  view: CommissionView; onView: (v: CommissionView) => void; selected: string[]; onSelected: (ids: string[]) => void;
  categoryId: string; onCategory: (id: string) => void;
}) {
  const { data: tables = [] } = useCommissionTables();
  const { data: categories = [] } = useCategories();
  const [tq, setTq] = useState("");
  const [cq, setCq] = useState("");
  const [editing, setEditing] = useState<CommissionTable | "new" | null>(null);
  const remove = useHrMutation((id: string) => api(`/hr/commission-tables/${id}`, { method: "DELETE" }), "Đã xóa bảng hoa hồng");
  const shownTables = tables.filter((t) => norm(t.name).includes(norm(tq.trim())));
  const tree = flattenCategoryTree(categories).filter((c) => norm(c.name).includes(norm(cq.trim())));
  const toggle = (id: string, on: boolean) => onSelected(on ? [...selected, id] : selected.filter((x) => x !== id));

  return (
    <FilterSidebar className="h-fit min-h-[475px] text-[12px]">
      <FilterSection title="Kiểu hiển thị">
        <RadioOption checked={view === "PRODUCTS"} onSelect={() => onView("PRODUCTS")}>Hàng hóa</RadioOption>
        <RadioOption checked={view === "EMPLOYEES"} onSelect={() => onView("EMPLOYEES")}>Nhân viên áp dụng</RadioOption>
      </FilterSection>
      <FilterSection title="Bảng hoa hồng">
        <div className="relative">
          <Search className="absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input aria-label="Tìm kiếm bảng hoa hồng" placeholder="Tìm kiếm bảng hoa hồng" className={searchBox} value={tq} onChange={(e) => setTq(e.target.value)} />
        </div>
        <div className="max-h-48 space-y-1 overflow-y-auto">
          {shownTables.map((t) => (
            <div key={t.id} className="group flex items-center gap-2">
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                <input type="checkbox" className="size-4 shrink-0 accent-primary" checked={selected.includes(t.id)} onChange={(e) => toggle(t.id, e.target.checked)} />
                <span className={cn("truncate", !t.active && "text-muted-foreground line-through")}>{t.name}</span>
              </label>
              <button type="button" aria-label={`Sửa ${t.name}`} className="invisible group-hover:visible" onClick={() => setEditing(t)}>
                <Pencil className="size-3.5 text-muted-foreground hover:text-primary" /></button>
              <button type="button" aria-label={`Xóa ${t.name}`} className="invisible group-hover:visible"
                onClick={() => confirm(`Xóa bảng hoa hồng "${t.name}"? Nhân viên đang áp dụng sẽ bỏ áp dụng.`) && remove.mutate(t.id)}>
                <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" /></button>
            </div>
          ))}
        </div>
        <div className="border-t border-[#d9dbe0] pt-3">
          <button type="button" className="flex items-center gap-1.5 font-semibold hover:text-primary" onClick={() => setEditing("new")}>
            <CirclePlus className="size-4" /> Thêm bảng</button>
        </div>
      </FilterSection>
      {view === "PRODUCTS" && (
        <FilterSection title="Nhóm hàng">
          <div className="relative">
            <Search className="absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input aria-label="Tìm kiếm nhóm hàng" placeholder="Tìm kiếm nhóm hàng" className={searchBox} value={cq} onChange={(e) => setCq(e.target.value)} />
          </div>
          <div className="max-h-60 overflow-y-auto">
            <button type="button" onClick={() => onCategory("")} className={cn("block py-1 text-left", !categoryId && "font-semibold text-primary")}>Tất cả</button>
            {tree.map((c) => (
              <button key={c.id} type="button" onClick={() => onCategory(c.id)} style={{ paddingLeft: 10 + c.depth * 12 }}
                className={cn("block w-full py-1.5 text-left hover:text-primary", categoryId === c.id && "font-semibold text-primary")}>{c.name}</button>
            ))}
          </div>
        </FilterSection>
      )}
      {editing && <CommissionTableDialog table={editing === "new" ? undefined : editing} onClose={() => setEditing(null)}
        onSaved={(t) => { if (editing === "new") onSelected([...selected, t.id]); }} />}
    </FilterSidebar>
  );
}
