"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DETAIL_BTN, DETAIL_PANEL, SUB_HEAD } from "@/features/sales/invoice-list-kit";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { EmployeeAdvanceDialog } from "./employee-advance-dialog";
import { EmployeeFormDialog } from "./employee-form-dialog";
import { useEmployee, useHrMutation } from "./hr-queries";
import { salaryTypeLabel, type AdvanceItem, type Employee } from "./hr-types";

const Info = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="grid grid-cols-[140px_minmax(0,1fr)] border-b border-dashed border-[#e5e7eb] py-1.5">
    <span className="text-muted-foreground">{label}</span><span>{value || "—"}</span>
  </div>
);

/** Panel chi tiết mở dưới dòng nhân viên: thông tin, thiết lập lương, lịch sử tạm ứng; nút sửa / tạm ứng / nghỉ việc / xóa. */
export function EmployeeDetailPanel({ id }: { id: string }) {
  const { data: e } = useEmployee(id);
  const { data: advances = [] } = useQuery({ queryKey: ["hr", "advances", id], queryFn: () => api<AdvanceItem[]>(`/hr/employees/${id}/advances`) });
  const [editing, setEditing] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const toggle = useHrMutation((emp: Employee) => api(`/hr/employees/${emp.id}`, { method: "PUT", body: {
    ...emp, branchIds: emp.branches.map((b) => b.id), status: emp.status === "WORKING" ? "QUIT" : "WORKING",
  } }), "Đã cập nhật trạng thái");
  const remove = useHrMutation((emp: Employee) => api(`/hr/employees/${emp.id}`, { method: "DELETE" }), "Đã xóa nhân viên");
  if (!e) return <div className={`${DETAIL_PANEL} p-4`}>Đang tải…</div>;
  return (
    <div className={`${DETAIL_PANEL} space-y-4 p-4`}>
      <div className="grid grid-cols-2 gap-x-8">
        <div>
          <Info label="Mã nhân viên" value={e.code} /><Info label="Mã chấm công" value={e.timekeepingCode} />
          <Info label="Tên nhân viên" value={<b>{e.name}</b>} /><Info label="Ngày sinh" value={formatDate(e.birthday)} />
          <Info label="Giới tính" value={e.gender === "MALE" ? "Nam" : e.gender === "FEMALE" ? "Nữ" : ""} />
          <Info label="Số CMND/CCCD" value={e.idNumber} /><Info label="Số điện thoại" value={e.phone} />
          <Info label="Tài khoản" value={e.username} />
        </div>
        <div>
          <Info label="Phòng ban" value={e.departmentName} /><Info label="Chức danh" value={e.jobTitleName} />
          <Info label="Chi nhánh làm việc" value={e.branches.map((b) => b.name).join(", ")} />
          <Info label="Ngày bắt đầu làm" value={formatDate(e.startDate)} />
          <Info label="Loại lương" value={e.salaryType ? `${salaryTypeLabel(e.salaryType)}: ${formatMoney(e.salaryAmount)}` : "Chưa thiết lập lương"} />
          <Info label="Hoa hồng" value={e.commissionTableName} />
          <Info label="Phụ cấp / giảm trừ" value={`${e.allowances.length} phụ cấp, ${e.deductions.length} giảm trừ`} />
          <Info label="Nợ và tạm ứng" value={<b>{formatMoney(e.debt)}</b>} />
        </div>
      </div>
      {advances.length > 0 && (
        <table className="w-full text-[13px]">
          <thead className={SUB_HEAD}><tr><th>Thời gian</th><th>Loại</th><th className="text-right">Số tiền</th><th>Ghi chú</th></tr></thead>
          <tbody>{advances.slice(0, 10).map((a) => (
            <tr key={a.id} className={`border-b [&_td]:h-8 [&_td]:px-2 ${a.cancelled ? "text-muted-foreground line-through" : ""}`}>
              <td>{formatDateTime(a.occurredAt)}</td><td>{a.kind === "ADVANCE" ? "Tạm ứng" : "Khấu trừ lương"}</td>
              <td className="text-right">{formatMoney(a.amount)}</td><td>{a.note}</td>
            </tr>))}
          </tbody>
        </table>
      )}
      <div className="flex justify-end gap-2">
        <Button className={DETAIL_BTN} onClick={() => setEditing(true)}>Chỉnh sửa</Button>
        <Button variant="outline" className={DETAIL_BTN} onClick={() => setAdvancing(true)}>Tạm ứng</Button>
        <Button variant="outline" className={DETAIL_BTN} disabled={toggle.isPending} onClick={() => toggle.mutate(e)}>
          {e.status === "WORKING" ? "Ngừng làm việc" : "Cho làm việc lại"}
        </Button>
        <Button variant="outline" className={`${DETAIL_BTN} text-destructive`} disabled={remove.isPending}
          onClick={() => window.confirm(`Xóa nhân viên ${e.name}?`) && remove.mutate(e)}>Xóa</Button>
      </div>
      {editing && <EmployeeFormDialog employee={e} onClose={() => setEditing(false)} />}
      {advancing && <EmployeeAdvanceDialog employee={e} onClose={() => setAdvancing(false)} />}
    </div>
  );
}
