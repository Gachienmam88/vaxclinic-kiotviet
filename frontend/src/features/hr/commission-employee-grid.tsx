"use client";

import { useQueries } from "@tanstack/react-query";
import { DocCodeLink } from "@/components/ui/doc-code-link";
import { api } from "@/lib/api-client";
import { useAllEmployees, useHrMutation } from "./hr-queries";
import type { CommissionTable } from "./hr-types";
import { useT } from "@/lib/i18n";
import { hrNs } from "@/messages/hr";

/**
 * Kiểu hiển thị "Nhân viên áp dụng": mỗi nhân viên áp dụng tối đa 1 bảng hoa hồng (chọn ô = chuyển sang bảng đó).
 * Lưu gửi đúng danh sách nhân viên của bảng (PUT /employees).
 */
export function CommissionEmployeeGrid({ tables, allTables }: { tables: CommissionTable[]; allTables: CommissionTable[] }) {
  const t = useT(hrNs);
  const { data: employees = [] } = useAllEmployees();
  const assign = useHrMutation(({ tableId, ids }: { tableId: string; ids: string[] }) =>
    api(`/hr/commission-tables/${tableId}/employees`, { method: "PUT", body: { employeeIds: ids } }), t("commissionGrid.toastAssigned"));
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
          <th className={th}>{t("employee.code")}</th><th className={th}>{t("employee.name")}</th><th className={th}>{t("catalog.department")}</th><th className={th}>{t("catalog.jobTitle")}</th>
          {tables.map((tb) => <th key={tb.id} className={`${th} text-center`}>{tb.name}</th>)}
        </tr></thead>
        <tbody>
          {!tables.length && <tr><td colSpan={4} className="py-3 text-center text-[12px] text-muted-foreground">
            {t("commissionGrid.pickTableHint")}</td></tr>}
          {employees.map((e) => (
            <tr key={e.id} className="border-b border-[#eceef1] hover:bg-[#f3f6fa] [&_td]:px-2 [&_td]:py-2">
              <td><DocCodeLink code={e.code} /></td><td>{e.name}</td><td>{e.departmentName}</td><td>{e.jobTitleName}</td>
              {tables.map((tb) => (
                <td key={tb.id} className="text-center">
                  <input type="checkbox" aria-label={t("commissionGrid.applyAria", { employee: e.name, table: tb.name })} className="size-4 accent-primary"
                    disabled={assign.isPending} checked={(members.get(tb.id) ?? []).includes(e.id)}
                    onChange={(ev) => toggle(tb.id, e.id, ev.target.checked)} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!!tables.length && <p className="pt-2 text-[12px] text-muted-foreground">
        {t("commissionGrid.oneTableHint")}</p>}
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
