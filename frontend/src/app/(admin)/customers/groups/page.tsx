"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CustomerGroupDialog } from "@/features/sales/customer-group-dialog";
import { LIST_HEAD_ROW, PageTitle, TOOLBAR_BTN } from "@/features/sales/invoice-list-kit";
import { useCustomerGroups } from "@/features/sales/sales-queries";
import type { CustomerGroup } from "@/features/sales/sales-types";
import { api, errorMessage } from "@/lib/api-client";
import { formatMoney, formatNumber } from "@/lib/format";
import { useCurrentUser } from "@/lib/use-current-user";
import { cn } from "@/lib/utils";

export const groupDiscountLabel = (g: Pick<CustomerGroup, "discountType" | "discountValue">) =>
  !Number(g.discountValue) ? "" : g.discountType === "PERCENT" ? `${formatNumber(g.discountValue)}%` : formatMoney(g.discountValue);

/** Khách hàng → Nhóm khách hàng. Xóa nhóm: khách trong nhóm chuyển thành "chưa có nhóm" (không xóa khách). */
export default function CustomerGroupsPage() {
  const qc = useQueryClient();
  const { can } = useCurrentUser();
  const { data: groups } = useCustomerGroups();
  const [dialog, setDialog] = useState<{ group?: CustomerGroup } | null>(null);
  const manage = can("patient.manage");

  const remove = useMutation({
    mutationFn: (id: string) => api<{ unlinkedCustomers: number }>(`/customer-groups/${id}`, { method: "DELETE" }),
    onSuccess: (r) => {
      toast.success(`Đã xóa nhóm khách hàng${r.unlinkedCustomers ? `, ${r.unlinkedCustomers} khách được bỏ nhóm` : ""}`);
      ["customer-groups", "customers", "customer"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const askDelete = (g: CustomerGroup) => confirm(g.customerCount
    ? `Xóa nhóm "${g.name}"? ${g.customerCount} khách hàng trong nhóm sẽ chuyển thành chưa có nhóm.`
    : `Xóa nhóm "${g.name}"?`) && remove.mutate(g.id);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <PageTitle>Nhóm khách hàng</PageTitle>
        {manage && <Button variant="outline" className={cn(TOOLBAR_BTN, "ml-auto")} onClick={() => setDialog({})}>
          <Plus className="size-4" /> Nhóm khách hàng</Button>}
      </div>
      <div className="overflow-x-auto rounded-lg bg-background">
        <Table>
          <TableHeader><TableRow className={LIST_HEAD_ROW}>
            <TableHead className="pl-4">Tên nhóm</TableHead><TableHead className="text-right">Giảm giá</TableHead>
            <TableHead className="text-right">Số khách hàng</TableHead><TableHead>Ghi chú</TableHead><TableHead className="w-24 pr-4" />
          </TableRow></TableHeader>
          <TableBody>
            {groups && !groups.length && <TableRow className="hover:bg-transparent">
              <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">Chưa có nhóm khách hàng nào</TableCell></TableRow>}
            {groups?.map((g) => (
              <TableRow key={g.id}>
                <TableCell className="pl-4 font-medium">{g.name}</TableCell>
                <TableCell className="text-right">{groupDiscountLabel(g)}</TableCell>
                <TableCell className="text-right">{formatNumber(g.customerCount)}</TableCell>
                <TableCell className="whitespace-normal text-muted-foreground">{g.note}</TableCell>
                <TableCell className="pr-4 text-right">{manage && <>
                  <Button size="icon-sm" variant="ghost" title="Sửa" aria-label={`Sửa nhóm ${g.name}`} onClick={() => setDialog({ group: g })}>
                    <Pencil className="size-4" /></Button>
                  <Button size="icon-sm" variant="ghost" title="Xóa" aria-label={`Xóa nhóm ${g.name}`} className="text-destructive"
                    disabled={remove.isPending} onClick={() => askDelete(g)}><Trash2 className="size-4" /></Button>
                </>}</TableCell>
              </TableRow>))}
          </TableBody>
        </Table>
      </div>
      {dialog && <CustomerGroupDialog key={dialog.group?.id ?? "new"} group={dialog.group} onClose={() => setDialog(null)} />}
    </div>
  );
}
