"use client";

import { useQueries } from "@tanstack/react-query";
import { DocCodeLink } from "@/components/ui/doc-code-link";
import { api } from "@/lib/api-client";
import { useAllEmployees, useHrMutation } from "./hr-queries";
import type { CommissionTable } from "./hr-types";

/**
 * Kiểu hiển thị "Nhân viên áp dụng": mỗi nhân viên áp dụng tối đa 1 bảng hoa hồng (chọn ô = chuyển sang bảng đó).
 * Lưu gửi đúng danh sách nhân viên của bảng (PUT /employees).
 */
export function CommissionEmployeeGrid({ tables, allTables }: { tables: CommissionTable[]; allTables: CommissionTable[] }) {
  const { data: employees = [] } = useAllEmployees();
  const assign = useHrMutation(({ tableId, ids }: { tableId: string; ids: string[] }) =>
    api(`/hr/commission-tables/${tableId}/employees`, { method: "PUT", body: { employeeIds: ids } }), "Đã cập nhật nhân viên áp dụng");
  const members = useTableMembers(allTables);
  const th = "h-[34px] px-2 text-[12px] font-semibold whitespace-nowrap";

  const toggle = (tableId: string, empId: string, on: boolean) => {
    const current = members.get(tableId) ?? [];
    const ids = on ? [...current, empId] : current.filter((x) => x !== empId);
    assign.mutate({ tableId, ids });
  };

  return (
    <div className="overflow-x-auto rounded-lg bg-white p-2.5">
      <table className="w-full text-[13px]">
        <thead><tr className="bg-primary-tint text-left">
          <th className={th}>Mã nhân viên</th><th className={th}>Tên nhân viên</th><th className={th}>Phòng ban</th><th className={th}>Chức danh</th>
          {tables.map((t) => <th key={t.id} className={`${th} text-center`}>{t.name}</th>)}
        </tr></thead>
        <tbody>
          {!tables.length && <tr><td colSpan={4} className="py-3 text-center text-[12px] text-muted-foreground">
            Chọn bảng hoa hồng ở bên trái để gán nhân viên áp dụng</td></tr>}
          {employees.map((e) => (
            <tr key={e.id} className="border-b border-[#eceef1] hover:bg-[#f3f6fa] [&_td]:px-2 [&_td]:py-2">
              <td><DocCodeLink code={e.code} /></td><td>{e.name}</td><td>{e.departmentName}</td><td>{e.jobTitleName}</td>
              {tables.map((t) => (
                <td key={t.id} className="text-center">
                  <input type="checkbox" aria-label={`${e.name} áp dụng ${t.name}`} className="size-4 accent-primary"
                    disabled={assign.isPending} checked={(members.get(t.id) ?? []).includes(e.id)}
                    onChange={(ev) => toggle(t.id, e.id, ev.target.checked)} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!!tables.length && <p className="pt-2 text-[12px] text-muted-foreground">
        Mỗi nhân viên chỉ áp dụng 1 bảng hoa hồng; chọn bảng khác sẽ chuyển nhân viên sang bảng đó.</p>}
    </div>
  );
}


/** Danh sách nhân viên của từng bảng hoa hồng (GET /hr/commission-tables/{id}/employees). */
function useTableMembers(tables: CommissionTable[]) {
  const results = useQueries({
    queries: tables.map((t) => ({
      queryKey: ["hr", "commission-members", t.id],
      queryFn: () => api<string[]>(`/hr/commission-tables/${t.id}/employees`),
    })),
  });
  const map = new Map<string, string[]>();
  tables.forEach((t, i) => map.set(t.id, results[i]?.data ?? []));
  return map;
}
