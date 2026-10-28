"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBranches, useShopSettings } from "@/features/settings/settings-queries";
import { api, errorMessage } from "@/lib/api-client";
import { CustomerGeneralFields, CustomerInvoiceFields, TEXT_FIELDS, type CustomerForm, type FieldProps, type TextField } from "./customer-form-fields";
import { kvDialog, kvDialogFooter, kvDialogHeader, kvTabsList, kvTabsTrigger } from "./customer-ui-primitives";
import { useCustomerGroups } from "./sales-queries";
import type { Customer } from "./sales-types";

type Props = { customer?: Customer; branchId: string; onClose: () => void; onSaved?: (c: Customer) => void };

/** Thêm / sửa khách hàng: tab Thông tin chung + tab Thông tin xuất hóa đơn. */
export function CustomerFormDialog({ customer, branchId, onClose, onSaved }: Props) {
  const qc = useQueryClient();
  const { data: groups = [] } = useCustomerGroups();
  const { data: branches = [] } = useBranches();
  const { data: shop } = useShopSettings();
  const req = (field: string) => shop?.customer.requiredFields.includes(field) ?? false;
  const [f, setF] = useState<CustomerForm>(() => ({
    ...(Object.fromEntries(TEXT_FIELDS.map((k) => [k, (customer?.[k] as string | null) ?? ""])) as Record<TextField, string>),
    gender: customer?.gender ?? "", customerType: customer?.customerType ?? "PERSONAL",
  }));
  const bind = (k: TextField) => ({
    value: f[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF((x) => ({ ...x, [k]: e.target.value })),
  });

  const save = useMutation({
    mutationFn: () => {
      const body = { ...f, gender: f.gender || null, birthday: f.birthday || null, groupId: f.groupId || null, branchId };
      return customer
        ? api<Customer>(`/customers/${customer.id}`, { method: "PUT", body })
        : api<Customer>("/customers", { method: "POST", body });
    },
    onSuccess: (c) => {
      toast.success(customer ? "Đã cập nhật khách hàng" : `Đã thêm khách hàng ${c.code}`);
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["customer", c.id] });
      qc.invalidateQueries({ queryKey: ["customer-groups"] });
      onSaved?.(c);
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const fields: FieldProps = { f, setF, bind, req, groups };
  const branchName = branches.find((b) => b.id === (customer?.branchId ?? branchId))?.name;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={`${kvDialog} sm:max-w-[964px]`}>
        <DialogHeader className={`${kvDialogHeader} pt-5`}>
          <DialogTitle className="flex items-center gap-2 text-[16px] font-bold">
            {customer ? "Sửa khách hàng" : "Thêm khách hàng"}
            {branchName && <span className="flex items-center gap-2 text-[13px] font-normal text-foreground/70">
              <span className="h-3 w-px bg-[#d9dbe0]" />Chi nhánh tạo: {branchName}</span>}
          </DialogTitle>
        </DialogHeader>
        <form id="customer-form" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <Tabs defaultValue="general">
            <TabsList variant="line" className={`${kvTabsList} gap-10 px-[42px]`}>
              <TabsTrigger value="general" className={kvTabsTrigger}>Thông tin chung</TabsTrigger>
              <TabsTrigger value="invoice" className={kvTabsTrigger}>Thông tin xuất hóa đơn</TabsTrigger>
            </TabsList>
            <TabsContent value="general" className="px-7 pt-5 pb-2"><CustomerGeneralFields {...fields} /></TabsContent>
            <TabsContent value="invoice" className="px-7 pt-5 pb-2"><CustomerInvoiceFields {...fields} /></TabsContent>
          </Tabs>
        </form>
        <DialogFooter className={`${kvDialogFooter} gap-3 border-t-0 pt-4 pb-5`}>
          <Button variant="outline" className="h-9 w-[92px] rounded-md border-primary text-[13px] font-semibold text-primary hover:bg-primary/5 hover:text-primary" onClick={onClose}>Bỏ qua</Button>
          <Button type="submit" form="customer-form" className="h-9 w-[92px] rounded-md text-[13px] font-semibold" disabled={save.isPending}>Lưu</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
