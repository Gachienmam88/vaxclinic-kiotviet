"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ListEmptyRow } from "@/components/ui/list-empty-state";
import { groupDiscountLabel } from "@/features/sales/customer-group-discount";
import { CustomerGroupDialog } from "@/features/sales/customer-group-dialog";
import { LIST_HEAD_ROW, PageTitle, TOOLBAR_BTN } from "@/features/sales/invoice-list-kit";
import { useCustomerGroups } from "@/features/sales/sales-queries";
import type { CustomerGroup } from "@/features/sales/sales-types";
import { api, errorMessage } from "@/lib/api-client";
import { formatNumber } from "@/lib/format";
import { useCurrentUser } from "@/lib/use-current-user";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { customersNs } from "@/messages/customers";

/** Khách hàng → Nhóm khách hàng. Xóa nhóm: khách trong nhóm chuyển thành "chưa có nhóm" (không xóa khách). */
export default function CustomerGroupsPage() {
  const t = useT(customersNs);
  const tc = useT(commonNs);
  const qc = useQueryClient();
  const { can } = useCurrentUser();
  const { data: groups } = useCustomerGroups();
  const [dialog, setDialog] = useState<{ group?: CustomerGroup } | null>(null);
  const manage = can("patient.manage");

  const remove = useMutation({
    mutationFn: (id: string) => api<{ unlinkedCustomers: number }>(`/customer-groups/${id}`, { method: "DELETE" }),
    onSuccess: (r) => {
      toast.success(r.unlinkedCustomers ? t("groups.deletedUnlinked", { count: r.unlinkedCustomers }) : t("groups.deleted"));
      ["customer-groups", "customers", "customer"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const askDelete = (g: CustomerGroup) => confirm(g.customerCount
    ? t("groups.confirmDeleteWithCustomers", { name: g.name, count: g.customerCount })
    : t("groups.confirmDelete", { name: g.name })) && remove.mutate(g.id);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <PageTitle>{t("groups.title")}</PageTitle>
        {manage && <Button variant="outline" className={cn(TOOLBAR_BTN, "ml-auto")} onClick={() => setDialog({})}>
          <Plus className="size-4" /> {t("groups.addButton")}</Button>}
      </div>
      <div className="overflow-x-auto rounded-lg bg-background">
        <Table>
          <TableHeader><TableRow className={LIST_HEAD_ROW}>
            <TableHead className="pl-4">{t("groups.cols.name")}</TableHead><TableHead className="text-right">{t("groups.cols.discount")}</TableHead>
            <TableHead className="text-right">{t("groups.cols.count")}</TableHead><TableHead>{t("groups.cols.note")}</TableHead><TableHead className="w-24 pr-4" />
          </TableRow></TableHeader>
          <TableBody>
            {groups && !groups.length && <ListEmptyRow cols={5} what={t("groups.emptyWhat")} />}
            {groups?.map((g) => (
              <TableRow key={g.id}>
                <TableCell className="pl-4 font-medium">{g.name}</TableCell>
                <TableCell className="text-right">{groupDiscountLabel(g)}</TableCell>
                <TableCell className="text-right">{formatNumber(g.customerCount)}</TableCell>
                <TableCell className="whitespace-normal text-muted-foreground">{g.note}</TableCell>
                <TableCell className="pr-4 text-right">{manage && <>
                  <Button size="icon-sm" variant="ghost" title={tc("actions.edit")} aria-label={t("groups.editAria", { name: g.name })} onClick={() => setDialog({ group: g })}>
                    <Pencil className="size-4" /></Button>
                  <Button size="icon-sm" variant="ghost" title={tc("actions.delete")} aria-label={t("groups.deleteAria", { name: g.name })} className="text-destructive"
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
